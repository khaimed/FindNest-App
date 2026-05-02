const axios   = require('axios');
const cheerio = require('cheerio');
const { randomUUID } = require('crypto');
const BaseScraper = require('../scraper.interface');
const { parsePrice } = require('../../utils/price-parser');
const logger = require('../../utils/logger');

const BASE_URL = 'https://www.marjanemall.ma';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'fr-MA,fr;q=0.9,ar;q=0.8',
  'Referer': 'https://www.marjanemall.ma/',
};

const REQUEST_TIMEOUT = 12_000;

const SEARCH_URLS = (kw) => [
  `${BASE_URL}/catalogsearch/result/?q=${encodeURIComponent(kw)}`,
  `${BASE_URL}/search?q=${encodeURIComponent(kw)}`,
  `${BASE_URL}/recherche?s=${encodeURIComponent(kw)}`,
];

class MarjaneMallScraper extends BaseScraper {
  constructor() {
    super('marjanemall');
    this.retries = 0;
  }

  async search(keyword) {
    logger.info(`[marjanemall] Searching: "${keyword}"`);

    // ── Strategy 1: plain HTTP ─────────────────────────────────────────────
    for (const url of SEARCH_URLS(keyword)) {
      try {
        const res      = await axios.get(url, { headers: HEADERS, timeout: REQUEST_TIMEOUT });
        const html     = res.data;

        // Try __NEXT_DATA__ first (if Next.js)
        const fromNext = this._parseNextData(html);
        if (fromNext && fromNext.length > 0) {
          logger.info(`[marjanemall] __NEXT_DATA__: ${fromNext.length} products`);
          return fromNext;
        }

        const products = this._parseHtml(html);
        if (products.length > 0) {
          logger.info(`[marjanemall] HTTP: ${products.length} products via ${url}`);
          return products;
        }
        logger.debug(`[marjanemall] 0 products at ${url}`);
      } catch (err) {
        logger.debug(`[marjanemall] ${url}: ${err.message}`);
      }
    }

    // ── Strategy 2: browser + JS extractor ────────────────────────────────
    logger.warn('[marjanemall] HTTP gave 0 results — trying browser…');
    try {
      const { executeInBrowser } = require('../../utils/browser-loader');
      const url = `${BASE_URL}/catalogsearch/result/?q=${encodeURIComponent(keyword)}`;

      // Wide JS extractor: works across Magento 2, SFCC, and generic React stores
      const EXTRACTOR = [
        '(function() {',
        '  // __NEXT_DATA__ if Next.js',
        '  try {',
        '    var nd = document.getElementById("__NEXT_DATA__");',
        '    if (nd) {',
        '      var d = JSON.parse(nd.textContent || "{}");',
        '      var pp = (d.props || {}).pageProps || {};',
        '      var prods = pp.products || pp.items || pp.results || (pp.data && pp.data.products) || null;',
        '      if (prods && prods.length) return { source: "nextdata", items: prods };',
        '    }',
        '  } catch(e) {}',
        '',
        '  var seen = {}, items = [];',
        '  var CARD_SELS = [',
        '    ".product-item", ".item.product", ".product-tile",',
        '    "[class*=ProductCard]", "[class*=product-card]",',
        '    "[class*=ProductItem]", "li.product", "[data-pid]"',
        '  ];',
        '  var cards = null;',
        '  for (var i = 0; i < CARD_SELS.length; i++) {',
        '    cards = document.querySelectorAll(CARD_SELS[i]);',
        '    if (cards.length > 0) break;',
        '  }',
        '  if (!cards || !cards.length) return { source: "dom", items: [] };',
        '',
        '  cards.forEach(function(el) {',
        '    var a = el.querySelector(".product-item-link, .pdp-link a, .product-name a, h2 a, h3 a") || el.querySelector("a");',
        '    if (!a) return;',
        '    var href = a.getAttribute("href") || "";',
        '    if (!href || seen[href]) return;',
        '    seen[href] = true;',
        '    var title = (el.querySelector(".product-item-name, .product-name, .tile-body__name, h2, h3") || a).textContent.trim();',
        '    if (!title) return;',
        '    var priceEl = el.querySelector("[data-price-type=finalPrice] .price, .special-price .price, .price");',
        '    var oldEl   = el.querySelector("[data-price-type=oldPrice] .price, .old-price .price, del .price");',
        '    var img     = el.querySelector("img");',
        '    items.push({',
        '      url:       href,',
        '      title:     title,',
        '      priceText: priceEl ? priceEl.textContent.trim() : "",',
        '      oldPrice:  oldEl   ? oldEl.textContent.trim()   : "",',
        '      image:     img ? (img.currentSrc || img.src || img.getAttribute("data-src")) : null',
        '    });',
        '  });',
        '  return { source: "dom", items: items };',
        '})()',
      ].join('\n');

      const result = await executeInBrowser(url, EXTRACTOR, { waitMs: 5500 });

      if (result?.source === 'nextdata' && Array.isArray(result.items)) {
        const products = result.items.map(p => this._normalizeNextItem(p)).filter(Boolean);
        logger.info(`[marjanemall] Browser + __NEXT_DATA__: ${products.length} products`);
        return products;
      }

      if (result?.source === 'dom' && Array.isArray(result.items)) {
        const products = result.items.map(item => ({
          id:               randomUUID(),
          title:            item.title,
          price:            parsePrice(item.priceText),
          oldPrice:         parsePrice(item.oldPrice),
          currency:         'MAD',
          url:              item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
          image:            item.image || null,
          website:          'marjanemall.ma',
          seller:           null,
          rating:           null,
          reviewCount:      null,
          availability:     true,
          deliveryInfo:     null,
          location:         null,
          scrapedAt:        new Date().toISOString(),
          score:            0,
          scoreExplanation: [],
        }));
        logger.info(`[marjanemall] Browser: ${products.length} products`);
        return products;
      }

      return [];
    } catch (err) {
      logger.error(`[marjanemall] Browser failed: ${err.message}`);
      return [];
    }
  }

  // ── Next.js __NEXT_DATA__ ────────────────────────────────────────────────

  _parseNextData(html) {
    try {
      const match = html.match(
        /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
      );
      if (!match) return null;

      const json     = JSON.parse(match[1]);
      const pp       = json?.props?.pageProps;
      const products =
        pp?.products       ||
        pp?.items          ||
        pp?.results        ||
        pp?.data?.products ||
        pp?.data?.items    ||
        null;

      if (!Array.isArray(products) || products.length === 0) return null;
      return products.map(p => this._normalizeNextItem(p)).filter(Boolean);
    } catch {
      return null;
    }
  }

  _normalizeNextItem(item) {
    try {
      const url = item.url || item.pdpUrl || item.link || '';
      if (!url) return null;

      return {
        id:               String(item.id || item.productId || randomUUID()),
        title:            item.name || item.title || '',
        price:            parsePrice(String(item.price ?? item.sellingPrice ?? '')),
        oldPrice:         parsePrice(String(item.originalPrice ?? item.listPrice ?? '')),
        currency:         'MAD',
        url:              url.startsWith('http') ? url : `${BASE_URL}${url}`,
        image:            item.image || item.thumbnail || item.images?.[0] || null,
        website:          'marjanemall.ma',
        seller:           null,
        rating:           item.rating ?? null,
        reviewCount:      item.reviewCount ?? null,
        availability:     item.inStock !== false,
        deliveryInfo:     null,
        location:         null,
        scrapedAt:        new Date().toISOString(),
        score:            0,
        scoreExplanation: [],
      };
    } catch { return null; }
  }

  // ── HTML / CSS parsing ────────────────────────────────────────────────────

  _parseHtml(html) {
    const $        = cheerio.load(html);
    const products = [];

    // Try selectors from most to least specific (Magento 2, SFCC, generic React)
    const $items = this._findItems($);
    if ($items.length === 0) return products;

    $items.each((_, el) => {
      try {
        const $el = $(el);

        const linkEl = $el.find(
          '.product-item-link, .product-item-name a, ' +
          '.pdp-link a, .product-name a, .product-title a, ' +
          'h2 a, h3 a, h4 a, a[href*="/p/"], a[href*="/product"]'
        ).first();

        const href = linkEl.attr('href') || $el.find('a').first().attr('href') || '';
        if (!href) return;

        const url   = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        const title =
          linkEl.text().trim() ||
          $el.find(
            '.product-item-name, .product-name, .product-title, ' +
            '[class*="ProductName"], [class*="product-name"], h2, h3'
          ).first().text().trim();
        if (!title) return;

        const priceEl = $el.find(
          '[data-price-type="finalPrice"] .price, .special-price .price, ' +
          '.price-box .price, .price, [class*="price"]:not([class*="old"])'
        ).first();

        const oldPriceEl = $el.find(
          '[data-price-type="oldPrice"] .price, .old-price .price, ' +
          'del .price, s .price, [class*="old-price"]'
        ).first();

        const imgEl  = $el.find('img').first();
        const imgSrc = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy') || null;

        const stockText = $el.find('[class*="stock"], [class*="availability"]').text().toLowerCase();
        const inStock   = !stockText.includes('rupture') && !stockText.includes('indisponible');

        products.push({
          id:               randomUUID(),
          title,
          price:            parsePrice(priceEl.text().trim()),
          oldPrice:         parsePrice(oldPriceEl.text().trim()),
          currency:         'MAD',
          url,
          image:            imgSrc,
          website:          'marjanemall.ma',
          seller:           null,
          rating:           null,
          reviewCount:      null,
          availability:     inStock,
          deliveryInfo:     null,
          location:         null,
          scrapedAt:        new Date().toISOString(),
          score:            0,
          scoreExplanation: [],
        });
      } catch { /* skip */ }
    });

    return products;
  }

  _findItems($) {
    const candidates = [
      // Magento 2
      '.product-item',
      '.item.product',
      // Salesforce Commerce Cloud
      '.product-tile',
      '[class*="product-tile"]',
      // Generic React/Next stores
      '[class*="ProductCard"]',
      '[class*="product-card"]',
      '[class*="ProductItem"]',
      '[class*="product-item"]',
      // WooCommerce
      'li.product',
      // Fallback
      '[data-product-id]',
      '[data-pid]',
    ];

    for (const sel of candidates) {
      const found = $(sel);
      if (found.length > 0) return found;
    }
    return $();
  }
}

module.exports = MarjaneMallScraper;
