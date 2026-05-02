const AvitoScraper         = require('./sites/avito.scraper');
const JumiaScraper         = require('./sites/jumia.scraper');
const ElectroplanetScraper = require('./sites/electroplanet.scraper');
const MytechScraper        = require('./sites/mytek.scraper');
const MarjaneMallScraper   = require('./sites/marjanemall.scraper');
const logger = require('../utils/logger');

/**
 * Registry of all available scrapers.
 * To add a new site: import its scraper class and add it here.
 */
const SCRAPERS = {
  avito:         new AvitoScraper(),
  jumia:         new JumiaScraper(),
  electroplanet: new ElectroplanetScraper(),
  mytech:        new MytechScraper(),
  marjanemall:   new MarjaneMallScraper(),
};

/**
 * Run scrapers for the requested sites in parallel.
 * A single site failure does NOT cancel the others.
 *
 * @param {string}         keyword
 * @param {string[]|'all'} sites
 * @param {Function}       [onProgress]
 * @returns {Promise<NormalizedProduct[]>}
 */
async function scrapeAll(keyword, sites, onProgress) {
  const siteKeys = sites === 'all' ? Object.keys(SCRAPERS) : sites;
  const total    = siteKeys.length;
  let   completed = 0;
  const allProducts = [];

  await Promise.allSettled(
    siteKeys.map(async (site) => {
      const scraper = SCRAPERS[site];
      if (!scraper) {
        logger.warn(`[manager] No scraper registered for: ${site}`);
        completed++;
        onProgress?.({ site, completed, total, percent: pct(completed, total), count: 0 });
        return;
      }

      try {
        // Hard cap: no single site can stall the entire search beyond 60 s
        const products = await Promise.race([
          scraper.search(keyword),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Site timeout (60 s)')), 60_000)
          ),
        ]);
        allProducts.push(...products);
        completed++;
        onProgress?.({ site, completed, total, percent: pct(completed, total), count: products.length });
      } catch (err) {
        completed++;
        onProgress?.({ site, completed, total, percent: pct(completed, total), error: err.message, count: 0 });
        logger.error(`[manager] ${site} failed: ${err.message}`);
      }
    })
  );

  return allProducts;
}

function getSupportedSites() {
  return Object.keys(SCRAPERS);
}

function pct(done, total) {
  return Math.round((done / total) * 100);
}

module.exports = { scrapeAll, getSupportedSites };
