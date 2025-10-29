// main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const iniParser = require('./iniParser');

let mainWindow;
let currentFilePath = path.join(__dirname, 'cream_api.ini'); // default


///////////////////// .-------------------------- API HELPERS --------------------------. /////////////////////
// --- Steam Store API helpers ---
async function getAppDetails(appid) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&l=en&cc=us`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`appdetails failed: ${r.status}`);
  const j = await r.json();
  const node = j?.[appid]?.data;
  return node || null;
}

async function getDlcForBaseApp(baseAppId) {
  const base = await getAppDetails(baseAppId);
  if (!base) return [];
  const dlcIds = Array.isArray(base.dlc) ? base.dlc : [];
  // fetch each DLC’s name & useful fields
  // throttle lightly to be polite
  const results = [];
  const chunkSize = 20;
  for (let i = 0; i < dlcIds.length; i += chunkSize) {
    const chunk = dlcIds.slice(i, i + chunkSize);
    const details = await Promise.all(chunk.map(async (id) => {
      const d = await getAppDetails(id);
      if (!d) return null;
      return {
        appid: String(d.steam_appid || id),
        name: d.name || `DLC ${id}`,
        type: d.type || '',
        release_date: d.release_date?.date || '',
        price: d.price_overview?.final_formatted || '',
      };
    }));
    for (const x of details) if (x && x.type === 'dlc') results.push(x);
  }
  return results;
}

async function searchAppsByName(query) {
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=en&cc=us`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`storesearch failed: ${r.status}`);
  const j = await r.json();
  // shape: { items: [{ id, name, tiny_image, ... }] }
  const items = j?.items || [];
  // We don’t always get type here; try to confirm via appdetails and keep DLC only.
  const top = items.slice(0, 30); // sanity cap
  const confirmed = await Promise.all(top.map(async it => {
    const details = await getAppDetails(it.id);
    if (details?.type === 'dlc') {
      return {
        appid: String(details.steam_appid || it.id),
        name: details.name || it.name,
        type: 'dlc',
        release_date: details.release_date?.date || '',
        price: details.price_overview?.final_formatted || '',
      };
    }
    return null;
  }));
  return confirmed.filter(Boolean);
}

///////////////////// .-------------------------- API HELPERS END --------------------------. /////////////////////

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




//---------------- Additional IPC handlers for DLC discovery/search ----------------//
ipcMain.handle('discover-dlc-by-appid', async (event, baseAppId) => {
  try {
    const list = await getDlcForBaseApp(baseAppId);
    return { ok: true, list };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('search-dlc-by-name', async (event, query) => {
  try {
    const list = await searchAppsByName(query);
    return { ok: true, list };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});
//---------------- Additional IPC handlers for DLC discovery/search END ----------------//


