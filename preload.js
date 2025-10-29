// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  chooseFile: () => ipcRenderer.invoke('choose-file'),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  addDlc: (id, name) => ipcRenderer.invoke('add-dlc', id, name),
  removeDlc: (id) => ipcRenderer.invoke('remove-dlc', id),
  updateSteamField: (key, value) => ipcRenderer.invoke('update-steam-field', key, value),
  discoverDlcByAppId: (appid) => ipcRenderer.invoke('discover-dlc-by-appid', appid),
  searchDlcByName: (q) => ipcRenderer.invoke('search-dlc-by-name', q),

});
