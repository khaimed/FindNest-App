const { ipcMain, shell } = require('electron');
const { scrapeAll, getSupportedSites } = require('./services/scraper/scraper-manager');
const { rankProducts, getWinner }      = require('./services/ranking/winner-engine');
const { exportToExcel }                = require('./services/export/excel-exporter');
const productStore                     = require('./services/storage/product-store');
const logger                           = require('./services/utils/logger');

let _mainWindow = null;

function setMainWindow(win) {
  _mainWindow = win;
}

function send(channel, data) {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send(channel, data);
  }
}

function setupIpc() {
  // ── Static info ───────────────────────────────────────────────────────────
  ipcMain.handle('get-sites', () => getSupportedSites());

  // ── Search ────────────────────────────────────────────────────────────────
  ipcMain.handle('search', async (_event, { keyword, sites }) => {
    if (!keyword || !keyword.trim()) {
      return { success: false, error: 'Le mot-clé est requis.' };
    }

    const kw = keyword.trim();
    logger.info(`Search started: "${kw}" | sites: ${JSON.stringify(sites)}`);
    productStore.newSearch(kw);

    try {
      const raw = await scrapeAll(kw, sites || 'all', (progress) => {
        send('search-progress', progress);
      });

      if (raw.length === 0) {
        send('search-complete', { products: [], winner: null, keyword: kw, total: 0 });
        return { success: true, total: 0 };
      }

      const ranked = rankProducts(raw, kw);
      productStore.addMany(ranked);

      const winner = getWinner(ranked);
      send('search-complete', { products: ranked, winner, keyword: kw, total: ranked.length });
      return { success: true, total: ranked.length };

    } catch (err) {
      logger.error('Search error:', err);
      send('search-error', { message: err.message });
      return { success: false, error: err.message };
    }
  });

  // ── Export ────────────────────────────────────────────────────────────────
  ipcMain.handle('export-excel', async (_event, { keyword } = {}) => {
    try {
      return await exportToExcel(productStore.getAll(), keyword || productStore.currentKeyword);
    } catch (err) {
      logger.error('Export error:', err);
      return { success: false, reason: err.message };
    }
  });

  // ── Shell ─────────────────────────────────────────────────────────────────
  ipcMain.handle('open-external', (_event, url) => {
    // Basic URL validation to prevent arbitrary shell execution
    if (typeof url === 'string' && /^https?:\/\//.test(url)) {
      return shell.openExternal(url);
    }
  });
}

module.exports = { setupIpc, setMainWindow };
