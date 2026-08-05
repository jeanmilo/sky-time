const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('timerAPI', {
  alarm: () => ipcRenderer.send('alarm'),
  quit: () => ipcRenderer.send('quit')
});