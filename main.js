// main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const iniParser = require('./iniParser');

let mainWindow;
let currentFilePath = path.join(__dirname, 'cream_api.ini'); // default

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('choose-file', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'INI files', extensions: ['ini', 'cfg', 'txt'] }, { name: 'All Files', extensions: ['*'] }]
  });
  if (res.canceled) return { canceled: true };
  currentFilePath = res.filePaths[0];
  return { canceled: false, path: currentFilePath };
});

ipcMain.handle('load-config', async () => {
  try {
    const raw = fs.readFileSync(currentFilePath, 'utf8');
    const parsed = iniParser.parseIniPreserve(raw);
    // parsed = { raw, steam: {...}, dlc: {id: name}, dlcStartLine, dlcEndLine }
    return { ok: true, config: parsed, path: currentFilePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('add-dlc', async (event, dlcId, dlcName) => {
  try {
    const raw = fs.readFileSync(currentFilePath, 'utf8');
    const parsed = iniParser.parseIniPreserve(raw);
    parsed.dlc[dlcId] = dlcName;
    const newRaw = iniParser.replaceDlcBlock(parsed.raw, parsed.dlc);
    fs.writeFileSync(currentFilePath, newRaw, 'utf8');
    return { ok: true, dlc: parsed.dlc };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('remove-dlc', async (event, dlcId) => {
  try {
    const raw = fs.readFileSync(currentFilePath, 'utf8');
    const parsed = iniParser.parseIniPreserve(raw);
    delete parsed.dlc[dlcId];
    const newRaw = iniParser.replaceDlcBlock(parsed.raw, parsed.dlc);
    fs.writeFileSync(currentFilePath, newRaw, 'utf8');
    return { ok: true, dlc: parsed.dlc };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('update-steam-field', async (event, key, value) => {
  try {
    const raw = fs.readFileSync(currentFilePath, 'utf8');
    // We'll delegate to iniParser to update steam block while preserving rest.
    const updatedRaw = iniParser.replaceSteamField(raw, key, value);
    fs.writeFileSync(currentFilePath, updatedRaw, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});
