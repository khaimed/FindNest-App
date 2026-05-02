const axios   = require('axios');
const cheerio = require('cheerio');
const { randomUUID } = require('crypto');
const BaseScraper = require('../scraper.interface');
const { parsePrice } = require('../../utils/price-parser');
const logger = require('../../utils/logger');

const BASE_URL = 'https://www.hmall.ma';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'fr-MA,fr;q=0.9,ar;q=0.8',
};

// Hmall.ma uses WooCommerce / custom platform
// Selectors ordered from most to least specific
const PRODUCT_SELECTORS    = ['.product-grid-item', '.product_item', '.product', 'li.product'];
const TITLE_SELECTORS      = ['.woocommerce-loop-product__title', '.product-title', '.woo-loop-product__title', 'h2', 'h3'];
const PRICE_SELECTORS      = ['.price .woocommerce-Price-amount', '.price', '.product-price', '[class*="price"]'];
const OLD_PRICE_SELECTORS  = ['del .woocommerce-Price-amount', 'del .amount', '.old-price'];
const LINK_SELECTORS       = ['a.woocommerce-loop-product__link', 'a[href*="hmall.ma"]', '.product a', 'a'];
const IMAGE_SELECTORS      = ['.wp-post-image', 'img.attachment-woocommerce_thumbnail', 'img'];

class HmallScraper extends BaseScraper {
  constructor() {
    super('hmall');
    // Hmall may need slightly longer timeout
    this.timeout = 22_000;
  }

  async search(keyword) {
    logger.info(`[hmall] Searching: "${keyword}"`);
    let lastError;

    // Try two possible search URL patterns
    const urls = [
      `${BASE_URL}/?s=${encodeURIComponent(keyword)}&post_type=product`,
      `${BASE_URL}/search?q=${encodeURIComponent(keyword)}`,
    ];

    for (let attempt = 1; attempt <= this.retries + 1; attempt++) {
      for (const url of urls) {
        try {
          const res  = await axios.get(url, { headers: HEADERS, timeout: this.timeout });
          const products = this._parse(res.data);
          if (products.length > 0) {
            logger.info(`[hmall] Found ${products.length} products via ${url}`);
            return products;
          }
        } catch (err) {
          lastError = err;
          logger.debug(`[hmall] ${url} failed: ${err.message}`);
        }
      }

      if (attempt <= this.retries) await this._sleep(this._backoff(attempt));
    }

    logger.warn('[hmall] All attempts returned 0 products');
    if (lastError) throw lastError;
    return [];
  }

  _parse(html) {
    const $        = cheerio.load(html);
    const products = [];

    const $items = this._find($, PRODUCT_SELECTORS);

    $items.each((_, el) => {
      try {
        const $el = $(el);

        const linkEl   = this._findFirst($el, $, LINK_SELECTORS);
        const titleEl  = this._findFirst($el, $, TITLE_SELECTORS);
        const priceEl  = this._findFirst($el, $, PRICE_SELECTORS);
        const oldEl    = this._findFirst($el, $, OLD_PRICE_SELECTORS);
        const imgEl    = this._findFirst($el, $, IMAGE_SELECTORS);

        const href = linkEl?.attr('href') || $el.find('a').first().attr('href') || '';
        if (!href) return;

        const url   = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        const title = titleEl?.text().trim() || '';
        if (!title) return;

        const imgSrc = imgEl?.attr('src') || imgEl?.attr('data-src') || imgEl?.attr('data-lazy-src') || null;

        products.push({
          id:               randomUUID(),
          title,
          price:            parsePrice(priceEl?.text().trim() || ''),
          oldPrice:         parsePrice(oldEl?.text().trim() || ''),
          currency:         'MAD',
          url,
          image:            imgSrc,
          website:          'hmall.ma',
          seller:           null,
          rating:           this._parseRating($el, $),
          reviewCount:      this._parseReviewCount($el, $),
          availability:     !$el.find('.out-of-stock, .stock.out-of-stock').length,
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

  _find($, selectors) {
    for (const sel of selectors) {
      const found = $(sel);
      if (found.length > 0) return found;
    }
    return $();
  }

  _findFirst($el, $, selectors) {
    for (const sel of selectors) {
      const found = $el.find(sel).first();
      if (found.length > 0) return found;
    }
    return null;
  }

  _parseRating($el, $) {
    const starsEl = $el.find('[class*="star-rating"], .stars, [class*="rating"]').first();
    if (!starsEl.length) return null;
    const style = starsEl.attr('style') || '';
    const widthMatch = style.match(/width:\s*([\d.]+)%/);
    if (widthMatch) return Math.round((parseFloat(widthMatch[1]) / 100) * 5 * 10) / 10;
    const aria = starsEl.attr('aria-label') || '';
    const ariaMatch = aria.match(/([\d.]+)/);
    return ariaMatch ? parseFloat(ariaMatch[1]) : null;
  }

  _parseReviewCount($el, $) {
    const countEl = $el.find('.review-count, [class*="review"], .count').first();
    if (!countEl.length) return null;
    const match = countEl.text().match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }
}

module.exports = HmallScraper;
