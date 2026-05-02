const { app, BrowserWindow } = require('electron');
const path = require('path');
const { setupIpc, setMainWindow } = require('./ipc');

if (require('electron-squirrel-startup')) app.quit();

function createWindow() {
  const win = new BrowserWindow({
    width:  1100,
    height: 720,
    minWidth:  700,
    minHeight: 500,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'img', 'logo.png'),
    webPreferences: {
      nodeIntegration:  false,   // renderer cannot access Node.js directly
      contextIsolation: true,    // isolate renderer from preload context
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
    },
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  setMainWindow(win);
}

app.whenReady().then(() => {
  setupIpc();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
