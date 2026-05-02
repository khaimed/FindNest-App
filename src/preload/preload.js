const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose a minimal, typed API to the renderer.
 * Nothing from Node.js or Electron internals leaks through.
 */
contextBridge.exposeInMainWorld('findnest', {
  /** @returns {Promise<string[]>} list of supported site keys */
  getSites: () => ipcRenderer.invoke('get-sites'),

  /**
   * Start a product search.
   * @param {string}           keyword
   * @param {string[]|'all'}   sites
   */
  search: (keyword, sites) => ipcRenderer.invoke('search', { keyword, sites }),

  /** Export current results to Excel (opens save dialog in main process). */
  exportExcel: (keyword) => ipcRenderer.invoke('export-excel', { keyword }),

  /** Open a URL in the system default browser. */
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // ── Event subscriptions ──────────────────────────────────────────────────
  onProgress:      (cb) => ipcRenderer.on('search-progress', (_, d) => cb(d)),
  onSearchComplete:(cb) => ipcRenderer.on('search-complete',  (_, d) => cb(d)),
  onSearchError:   (cb) => ipcRenderer.on('search-error',    (_, d) => cb(d)),

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
