const axios   = require('axios');
const cheerio = require('cheerio');
const { randomUUID } = require('crypto');
const BaseScraper = require('../scraper.interface');
const { parsePrice } = require('../../utils/price-parser');
const logger = require('../../utils/logger');

const BASE_URL   = 'https://www.electroplanet.ma';
const SEARCH_URL = `${BASE_URL}/catalogsearch/result/`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'fr-MA,fr;q=0.9,ar;q=0.8',
  'Referer': 'https://www.electroplanet.ma/',
};

// Electroplanet.ma — Magento 2 store
// Blocks plain axios with 403; falls back to a hidden BrowserWindow
class ElectroplanetScraper extends BaseScraper {
  constructor() {
    super('electroplanet');
    this.timeout = 10_000; // short; if blocked, escalate to browser fast
    this.retries = 0;      // no point retrying the same blocked request
  }

  async search(keyword) {
    logger.info(`[electroplanet] Searching: "${keyword}"`);

    // ── Strategy 1: plain HTTP (fast, works if not blocked) ───────────────
    try {
      const res      = await axios.get(SEARCH_URL, {
        params:  { q: keyword },
        headers: HEADERS,
        timeout: this.timeout,
      });
      const products = this._parse(res.data);
      if (products.length > 0) {
        logger.info(`[electroplanet] HTTP: ${products.length} products`);
        return products;
      }
    } catch (err) {
      logger.warn(`[electroplanet] HTTP blocked (${err.message}), using browser…`);
    }

    // ── Strategy 2: hidden BrowserWindow (bypasses 403) ──────────────────
    try {
      const { loadPageHTML } = require('../../utils/browser-loader');
      const url  = `${SEARCH_URL}?q=${encodeURIComponent(keyword)}`;
      const html = await loadPageHTML(url, { waitMs: 3000 });
      const products = this._parse(html);
      logger.info(`[electroplanet] Browser: ${products.length} products`);
      return products;
    } catch (err) {
      logger.error(`[electroplanet] Browser failed: ${err.message}`);
      throw err;
    }
  }

  _parse(html) {
    const $        = cheerio.load(html);
    const products = [];

    $('.product-item, [class*="product-item"], .item.product').each((_, el) => {
      try {
        const $el = $(el);

        const linkEl = $el.find('.product-item-link, .product-item-name a').first();
        const href   = linkEl.attr('href') || $el.find('a').first().attr('href') || '';
        if (!href) return;

        const url   = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        const title = linkEl.text().trim() || $el.find('.product-item-name').text().trim();
        if (!title) return;

        // Magento 2 final/old price selectors
        const priceEl    = $el.find(
          '.price-wrapper [data-price-type="finalPrice"] .price, .special-price .price, .price-box .price'
        ).first();
        const oldPriceEl = $el.find(
          '.price-wrapper [data-price-type="oldPrice"] .price, .old-price .price'
        ).first();

        const imgEl  = $el.find('.product-image-photo, img').first();
        // data-src holds the real URL; src may be a 1×1 placeholder before lazy-load fires
        const imgSrc = imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src') || null;

        const stockText = $el.find('.stock, [class*="stock"]').text().toLowerCase();
        const inStock   = !stockText.includes('rupture') && !stockText.includes('indisponible');

        products.push({
          id:               randomUUID(),
          title,
          price:            parsePrice(priceEl.text().trim()),
          oldPrice:         parsePrice(oldPriceEl.text().trim()),
          currency:         'MAD',
          url,
          image:            imgSrc,
          website:          'electroplanet.ma',
          seller:           null,
          rating:           this._parseRating($el),
          reviewCount:      null,
          availability:     inStock,
          deliveryInfo:     $el.find('[class*="delivery"], [class*="livraison"]').text().trim() || null,
          location:         null,
          scrapedAt:        new Date().toISOString(),
          score:            0,
          scoreExplanation: [],
        });
      } catch { /* skip */ }
    });

    return products;
  }

  _parseRating($el) {
    const ratingEl = $el.find('.rating-result, [class*="rating"]').first();
    if (!ratingEl.length) return null;
    const title = ratingEl.attr('title') || '';
    const m1    = title.match(/([\d.]+)/);
    if (m1) return Math.min(parseFloat(m1[1]), 5);
    const style = ratingEl.children().first().attr('style') || '';
    const m2    = style.match(/width:\s*([\d.]+)%/);
    return m2 ? Math.round((parseFloat(m2[1]) / 100) * 5 * 10) / 10 : null;
  }
}

module.exports = ElectroplanetScraper;
