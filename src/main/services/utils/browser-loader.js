const logger = require('./logger');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Shared helper that creates and manages a hidden BrowserWindow.
 * Returns a Promise that resolves/rejects with the result of `task(webContents)`.
 */
async function _withBrowser(url, task, timeout = 35_000) {
  const { BrowserWindow } = require('electron');

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;

    const win = new BrowserWindow({
      show: false,
      width: 1366,
      height: 768,
      webPreferences: { nodeIntegration: false, contextIsolation: true, javascript: true },
    });

    const done = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { if (!win.isDestroyed()) win.destroy(); } catch {}
      fn();
    };

    timer = setTimeout(() => done(() => reject(new Error(`Browser timeout: ${url}`))), timeout);

    win.webContents.on('did-finish-load', () => {
      task(win.webContents)
        .then(v => done(() => resolve(v)))
        .catch(e => done(() => reject(e)));
    });

    win.webContents.on('did-fail-load', (_, code, desc) => {
      done(() => reject(new Error(`Load failed [${code}]: ${desc}`)));
    });

    win.loadURL(url, { userAgent: UA });
  });
}

/**
 * Load `url` in a hidden Chromium window, wait `waitMs` for JS to render,
 * then return the full document HTML.
 */
async function loadPageHTML(url, { timeout = 35_000, waitMs = 3500 } = {}) {
  logger.debug(`[browser-loader] loadPageHTML: ${url}`);
  return _withBrowser(url, async (wc) => {
    await _sleep(waitMs);
    return wc.executeJavaScript('document.documentElement.outerHTML');
  }, timeout);
}

/**
 * Load `url` in a hidden Chromium window, wait `waitMs`, optionally scroll
 * the page to trigger lazy-load, then execute `script` and return its value.
 *
 * `script` must be a self-contained JS expression, e.g. "(function(){ ... })()"
 */
async function executeInBrowser(url, script, { timeout = 35_000, waitMs = 4000, scroll = true } = {}) {
  logger.debug(`[browser-loader] executeInBrowser: ${url}`);
  return _withBrowser(url, async (wc) => {
    await _sleep(waitMs);
    if (scroll) {
      // Scroll to trigger IntersectionObserver-based lazy loading
      await wc.executeJavaScript('window.scrollTo(0, 600)');
      await _sleep(600);
    }
    return wc.executeJavaScript(script);
  }, timeout);
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { loadPageHTML, executeInBrowser };
