const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // API Key
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  setApiKey: (apiKey) => ipcRenderer.invoke('set-api-key', apiKey),
  hasApiKey: () => ipcRenderer.invoke('has-api-key'),

  // Playlist persistence
  savePlaylist: (filePaths) => ipcRenderer.invoke('save-playlist', filePaths),
  getPlaylist: () => ipcRenderer.invoke('get-playlist'),
  saveCurrentIndex: (index) => ipcRenderer.invoke('save-current-index', index),
  getCurrentIndex: () => ipcRenderer.invoke('get-current-index'),

  // File operations
  readFileBuffer: (filePath) => ipcRenderer.invoke('read-file-buffer', filePath),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),

  // Dialog operations
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),

  // Metadata
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
  extractMetadata: (filePath) => ipcRenderer.invoke('extract-metadata', filePath),

  // Discord Rich Presence
  updateDiscordPresence: (data) => ipcRenderer.invoke('update-discord-presence', data),
  clearDiscordPresence: () => ipcRenderer.invoke('clear-discord-presence'),
  checkLdacSupport: () => ipcRenderer.invoke('ldac-available'),

  isElectron: true
});
