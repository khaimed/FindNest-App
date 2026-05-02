/**
 * Base class every site scraper must extend.
 *
 * Contract:
 *   search(keyword) → Promise<NormalizedProduct[]>
 *
 * @typedef {Object} NormalizedProduct
 * @property {string}      id
 * @property {string}      title
 * @property {number|null} price
 * @property {number|null} oldPrice
 * @property {string}      currency
 * @property {string}      url
 * @property {string|null} image
 * @property {string}      website
 * @property {string|null} seller
 * @property {number|null} rating        0–5
 * @property {number|null} reviewCount
 * @property {boolean}     availability
 * @property {string|null} deliveryInfo
 * @property {string|null} location
 * @property {string}      scrapedAt     ISO-8601
 * @property {number}      score         0–100 (set by winner engine)
 * @property {string[]}    scoreExplanation
 */
class BaseScraper {
  /**
   * @param {string} name  - Site identifier, e.g. "avito"
   */
  constructor(name) {
    this.name    = name;
    this.timeout = 20_000;
    this.retries = 2;
  }

  /** @returns {Promise<NormalizedProduct[]>} */
  async search(keyword) {
    throw new Error(`${this.name}.search() not implemented`);
  }

  /** @returns {number} ms to wait before retry attempt */
  _backoff(attempt) {
    return 1500 * attempt;
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = BaseScraper;
