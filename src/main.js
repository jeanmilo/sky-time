const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();

  win = new BrowserWindow({
    width: 300,
    height: 460,
    x: workArea.x + workArea.width - 300 - 40,
    y: workArea.y + 60,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

// push window to the front when the countdown ends
ipcMain.on('alarm', () => {
  if (win && !win.isDestroyed()) win.showInactive();
});

// quit the app
ipcMain.on('quit', () => app.quit());

app.on('window-all-closed', () => app.quit());