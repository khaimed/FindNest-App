const axios   = require('axios');
const cheerio = require('cheerio');
const { randomUUID } = require('crypto');
const BaseScraper = require('../scraper.interface');
const { parsePrice } = require('../../utils/price-parser');
const logger = require('../../utils/logger');

const BASE_URL = 'https://www.avito.ma';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'fr-MA,fr;q=0.9,ar;q=0.8',
};

// ── JavaScript extractor — runs inside the live Chromium page ────────────────
// Uses var/function syntax for safety; no backticks inside the string.
const AVITO_EXTRACTOR = [
  '(function() {',
  '  try {',
  '    var nd = document.getElementById("__NEXT_DATA__");',
  '    if (nd) {',
  '      var d = JSON.parse(nd.textContent || "{}");',
  '      var pp = (d.props || {}).pageProps || {};',
  '      var lst = (pp.listings && pp.listings.data)',
  '        || (pp.data && pp.data.listings)',
  '        || pp.ads || null;',
  '      if (lst && lst.length) return { source: "nextdata", items: lst };',
  '    }',
  '  } catch(e) {}',
  '',
  '  var seen = {};',
  '  var items = [];',
  '  var root = document.querySelector("main") || document.body;',
  '',
  '  root.querySelectorAll("a[href]").forEach(function(a) {',
  '    var href = a.getAttribute("href") || "";',
  '    var segs = href.split("/").filter(function(s){ return s.length > 0; });',
  '',
  '    // Avito product links: /fr/{city}/{category}/{slug} — 4+ segments',
  '    if (!href.startsWith("/fr/") || segs.length < 4) return;',
  '    if (href.indexOf("?") > -1 || href.indexOf("#") > -1) return;',
  '    if (href.indexOf("/search") > -1) return;',
  '    if (seen[href]) return;',
  '    seen[href] = true;',
  '',
  '    var img = a.querySelector("img");',
  '    if (!img) return;',
  '',
  '    var imgSrc = img.currentSrc || img.src || img.getAttribute("data-src") || null;',
  '',
  '    var title = "", priceText = "";',
  '    var ps = a.querySelectorAll("p");',
  '    ps.forEach(function(p) {',
  '      var t = p.textContent.trim();',
  '      if (!t) return;',
  '      if (/[0-9]/.test(t) && (/dh|mad/i.test(t) || /[0-9]{1,3}\\s[0-9]{3}/.test(t))) {',
  '        if (!priceText) priceText = t;',
  '      } else if (!title) {',
  '        title = t;',
  '      }',
  '    });',
  '    if (!title) title = a.getAttribute("title") || "";',
  '    if (!title) return;',
  '',
  '    var locEl = a.querySelector("[class*=city" + "],[class*=location" + "],[class*=place" + "]");',
  '    items.push({',
  '      url: href,',
  '      image: imgSrc,',
  '      title: title,',
  '      priceText: priceText,',
  '      location: locEl ? locEl.textContent.trim() : ""',
  '    });',
  '  });',
  '',
  '  return { source: "dom", items: items };',
  '})()',
].join('\n');

class AvitoScraper extends BaseScraper {
  constructor() {
    super('avito');
  }

  async search(keyword) {
    logger.info(`[avito] Searching: "${keyword}"`);

    // Avito search URL: /fr/maroc/{keyword}  (NOT /search?keyword=)
    const searchUrl = `${BASE_URL}/fr/maroc/${encodeURIComponent(keyword)}`;

    // ── Strategy 1: axios + __NEXT_DATA__ (fast, works if SSR is active) ──
    try {
      const html     = await this._fetchHtml(searchUrl);
      const fromNext = this._parseNextData(html);
      if (fromNext && fromNext.length > 0) {
        logger.info(`[avito] __NEXT_DATA__: ${fromNext.length} products`);
        return fromNext;
      }
      logger.warn('[avito] axios returned no products — falling back to browser');
    } catch (err) {
      logger.warn(`[avito] axios failed: ${err.message} — falling back to browser`);
    }

    // ── Strategy 2: hidden BrowserWindow + JS extractor ───────────────────
    return this._scrapeWithBrowser(searchUrl);
  }

  async _fetchHtml(url) {
    const res = await axios.get(url, { headers: HEADERS, timeout: this.timeout });
    return res.data;
  }

  _parseNextData(html) {
    try {
      const match = html.match(
        /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
      );
      if (!match) return null;

      const json = JSON.parse(match[1]);
      const pp   = json?.props?.pageProps;
      const listings =
        pp?.listings?.data        ||
        pp?.data?.listings        ||
        pp?.initialData?.listings ||
        pp?.ads                   ||
        null;

      if (!Array.isArray(listings) || listings.length === 0) return null;
      return listings.map(l => this._normalizeNextItem(l)).filter(Boolean);
    } catch (e) {
      logger.debug(`[avito] __NEXT_DATA__ error: ${e.message}`);
      return null;
    }
  }

  _normalizeNextItem(item) {
    try {
      const rawUrl = item.url || item.relativeUrl || item.slug;
      if (!rawUrl) return null;
      const url = rawUrl.startsWith('http') ? rawUrl : `${BASE_URL}${rawUrl}`;

      return {
        id:               String(item.id || item.listingId || randomUUID()),
        title:            item.title || item.subject || '',
        price:            parsePrice(String(item.price ?? '')),
        oldPrice:         null,
        currency:         'MAD',
        url,
        image:            item.mainImage?.url || item.images?.[0]?.url || item.thumbnail || null,
        website:          'avito.ma',
        seller:           item.seller?.name || item.owner?.name || null,
        rating:           null,
        reviewCount:      null,
        availability:     true,
        deliveryInfo:     null,
        location:         item.city?.name || item.location || null,
        scrapedAt:        new Date().toISOString(),
        score:            0,
        scoreExplanation: [],
      };
    } catch { return null; }
  }

  async _scrapeWithBrowser(searchUrl) {
    const { executeInBrowser } = require('../../utils/browser-loader');
    logger.info(`[avito] Browser loading: ${searchUrl}`);

    try {
      const result = await executeInBrowser(searchUrl, AVITO_EXTRACTOR, { waitMs: 4500 });

      if (result?.source === 'nextdata' && Array.isArray(result.items)) {
        const products = result.items.map(l => this._normalizeNextItem(l)).filter(Boolean);
        logger.info(`[avito] Browser + __NEXT_DATA__: ${products.length} products`);
        return products;
      }

      if (result?.source === 'dom' && Array.isArray(result.items)) {
        const products = result.items.map(item => ({
          id:               randomUUID(),
          title:            item.title || '',
          price:            parsePrice(item.priceText || ''),
          oldPrice:         null,
          currency:         'MAD',
          url:              item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
          image:            item.image || null,
          website:          'avito.ma',
          seller:           null,
          rating:           null,
          reviewCount:      null,
          availability:     true,
          deliveryInfo:     null,
          location:         item.location || null,
          scrapedAt:        new Date().toISOString(),
          score:            0,
          scoreExplanation: [],
        }));
        logger.info(`[avito] Browser + DOM: ${products.length} products`);
        return products;
      }

      logger.warn('[avito] Browser returned no usable data');
      return [];
    } catch (err) {
      logger.error(`[avito] Browser failed: ${err.message}`);
      return [];
    }
  }
}

module.exports = AvitoScraper;
