const axios  = require('axios');
const cheerio = require('cheerio');
const { randomUUID } = require('crypto');
const BaseScraper = require('../scraper.interface');
const { parsePrice } = require('../../utils/price-parser');
const logger = require('../../utils/logger');

const BASE_URL   = 'https://www.jumia.ma';
const SEARCH_URL = 'https://www.jumia.ma/catalog/';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-MA,fr;q=0.9,en;q=0.7',
};

class JumiaScraper extends BaseScraper {
  constructor() {
    super('jumia');
  }

  async search(keyword) {
    logger.info(`[jumia] Searching: "${keyword}"`);
    let lastError;

    for (let attempt = 1; attempt <= this.retries + 1; attempt++) {
      try {
        const html     = await this._fetch(keyword);
        const products = this._parseHtml(html);
        logger.info(`[jumia] Found ${products.length} products`);
        return products;
      } catch (err) {
        lastError = err;
        logger.warn(`[jumia] Attempt ${attempt} failed: ${err.message}`);
        if (attempt <= this.retries) await this._sleep(this._backoff(attempt));
      }
    }

    throw lastError;
  }

  async _fetch(keyword, page = 1) {
    const res = await axios.get(SEARCH_URL, {
      params:  { q: keyword, page },
      headers: HEADERS,
      timeout: this.timeout,
    });
    return res.data;
  }

  _parseHtml(html) {
    const $        = cheerio.load(html);
    const products = [];

    // Jumia uses <article class="prd"> or elements with data-link
    $('article.prd, [data-link]').each((_, el) => {
      try {
        const $el = $(el);

        // URL
        const relUrl =
          $el.find('a.core').attr('href') ||
          $el.find('a[data-link]').attr('href') ||
          $el.attr('data-link') ||
          '';
        if (!relUrl) return;
        const url = relUrl.startsWith('http') ? relUrl : `${BASE_URL}${relUrl}`;

        // Title
        const title = $el.find('.name, [class*="name"]').first().text().trim();
        if (!title) return;

        // Prices
        const priceText    = $el.find('.prc, [class*="prc"]').first().text().trim();
        const oldPriceText = $el.find('.old, [class*="old"]').first().text().trim();

        // Image — Jumia lazy-loads with data-src
        const imgEl  = $el.find('img').first();
        const imgSrc = imgEl.attr('data-src') || imgEl.attr('src') || null;

        // Rating — Jumia uses data-stars attribute on the stars widget
        const ratingAttr = $el.find('[data-stars]').attr('data-stars');
        const rating     = ratingAttr ? parseFloat(ratingAttr) : null;

        // Review count — appears as "(123)"
        const reviewText  = $el.find('[class*="rev"], ._c').text().trim();
        const reviewMatch = reviewText.match(/\((\d[\d\s]*)\)/);
        const reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(/\s/g, ''), 10) : null;

        // Delivery / promotion badge
        const deliveryInfo =
          $el.find('[class*="bdg"][class*="delivery"], [class*="ship"]').text().trim() || null;

        products.push({
          id:               randomUUID(),
          title,
          price:            parsePrice(priceText),
          oldPrice:         parsePrice(oldPriceText),
          currency:         'MAD',
          url,
          image:            imgSrc,
          website:          'jumia.ma',
          seller:           null,
          rating,
          reviewCount,
          availability:     true,
          deliveryInfo,
          location:         null,
          scrapedAt:        new Date().toISOString(),
          score:            0,
          scoreExplanation: [],
        });
      } catch { /* skip malformed element */ }
    });

    return products;
  }
}

module.exports = JumiaScraper;
