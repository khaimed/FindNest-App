const axios   = require('axios');
const cheerio = require('cheerio');
const { randomUUID } = require('crypto');
const BaseScraper = require('../scraper.interface');
const { parsePrice } = require('../../utils/price-parser');
const logger = require('../../utils/logger');

const BASE_URL = 'https://www.mytech.ma';   // NOTE: mytech.ma (with h), not mytek.ma

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'fr-MA,fr;q=0.9',
  'Referer': `${BASE_URL}/`,
};

const REQUEST_TIMEOUT = 10_000;

const SEARCH_URLS = (kw) => [
  `${BASE_URL}/recherche?s=${encodeURIComponent(kw)}`,
  `${BASE_URL}/?controller=search&s=${encodeURIComponent(kw)}`,
  `${BASE_URL}/index.php?controller=search&s=${encodeURIComponent(kw)}`,
];

// JavaScript extractor for browser fallback (PrestaShop)
const MYTECH_EXTRACTOR = [
  '(function() {',
  '  var seen = {};',
  '  var items = [];',
  '  var cards = document.querySelectorAll(',
  '    "article.product-miniature, .product-miniature, ' +
    '.js-product-miniature, li.ajax_block_product, li.product"',
  '  );',
  '  cards.forEach(function(el) {',
  '    var a = el.querySelector(".product-title a, .product-name a, h1 a, h2 a, h3 a") || el.querySelector("a");',
  '    if (!a) return;',
  '    var href = a.getAttribute("href") || "";',
  '    if (!href || seen[href]) return;',
  '    seen[href] = true;',
  '    var title = (el.querySelector(".product-title, .product-name, h2, h3") || a).textContent.trim();',
  '    if (!title) return;',
  '    var priceEl = el.querySelector(".price:not(.regular-price), .product-price");',
  '    var oldEl   = el.querySelector(".regular-price, del .price, s .price");',
  '    var img     = el.querySelector("img");',
  '    items.push({',
  '      url:       href,',
  '      title:     title,',
  '      priceText: priceEl ? priceEl.textContent.trim() : "",',
  '      oldPrice:  oldEl   ? oldEl.textContent.trim()   : "",',
  '      image:     img ? (img.currentSrc || img.src || img.getAttribute("data-src")) : null',
  '    });',
  '  });',
  '  return items;',
  '})()',
].join('\n');

class MytekScraper extends BaseScraper {
  constructor() {
    super('mytech');
    this.retries = 0;
  }

  async search(keyword) {
    logger.info(`[mytech] Searching: "${keyword}"`);

    // ── Strategy 1: plain HTTP ─────────────────────────────────────────────
    for (const url of SEARCH_URLS(keyword)) {
      try {
        const res      = await axios.get(url, { headers: HEADERS, timeout: REQUEST_TIMEOUT });
        const products = this._parse(res.data);
        if (products.length > 0) {
          logger.info(`[mytech] HTTP: ${products.length} products via ${url}`);
          return products;
        }
        logger.debug(`[mytech] 0 products at ${url}`);
      } catch (err) {
        logger.debug(`[mytech] ${url}: ${err.message}`);
      }
    }

    // ── Strategy 2: browser + JS extractor ────────────────────────────────
    logger.warn('[mytech] HTTP gave 0 results — trying browser…');
    try {
      const { executeInBrowser } = require('../../utils/browser-loader');
      const url   = `${BASE_URL}/recherche?s=${encodeURIComponent(keyword)}`;
      const items = await executeInBrowser(url, MYTECH_EXTRACTOR, { waitMs: 4000 });

      if (!Array.isArray(items) || items.length === 0) {
        logger.warn('[mytech] Browser returned 0 products');
        return [];
      }

      const products = items.map(item => ({
        id:               randomUUID(),
        title:            item.title || '',
        price:            parsePrice(item.priceText || ''),
        oldPrice:         parsePrice(item.oldPrice  || ''),
        currency:         'MAD',
        url:              item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
        image:            item.image || null,
        website:          'mytech.ma',
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

      logger.info(`[mytech] Browser: ${products.length} products`);
      return products;
    } catch (err) {
      logger.error(`[mytech] Browser failed: ${err.message}`);
      return [];
    }
  }

  _parse(html) {
    const $        = cheerio.load(html);
    const products = [];

    $([
      'article.product-miniature',
      '.product-miniature',
      '.js-product-miniature',
      'li.ajax_block_product',
      'li.product',
    ].join(', ')).each((_, el) => {
      try {
        const $el = $(el);

        const linkEl = $el.find('.product-title a, .product-name a, h1 a, h2 a, h3 a').first();
        const href   = linkEl.attr('href') || $el.find('a').first().attr('href') || '';
        if (!href) return;

        const url   = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        const title = linkEl.text().trim() ||
          $el.find('.product-title, .product-name, h2, h3').first().text().trim();
        if (!title) return;

        const priceEl    = $el.find('.price:not(.regular-price), .product-price').first();
        const oldPriceEl = $el.find('.regular-price, del .price, s .price').first();

        const imgEl  = $el.find('img').first();
        const imgSrc = imgEl.attr('data-src') || imgEl.attr('src') || null;

        products.push({
          id:               randomUUID(),
          title,
          price:            parsePrice(priceEl.text().trim()),
          oldPrice:         parsePrice(oldPriceEl.text().trim()),
          currency:         'MAD',
          url,
          image:            imgSrc,
          website:          'mytech.ma',
          seller:           null,
          rating:           null,
          reviewCount:      null,
          availability:     true,
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
}

module.exports = MytekScraper;
