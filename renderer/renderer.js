// renderer.js
const chooseBtn = document.getElementById('choose-file');
const filepathSpan = document.getElementById('filepath');
const appidInput = document.getElementById('appid');
const unlockCheckbox = document.getElementById('unlockall');
const saveUnlockBtn = document.getElementById('save-unlock');


// DLC Table elements
const dlcTbody = document.querySelector('#dlc-table tbody');
const addBtn = document.getElementById('add-btn');
const newId = document.getElementById('new-id');
const newName = document.getElementById('new-name');
const search = document.getElementById('search');


// Discover DLC elements
const discoverAppId = document.getElementById('discover-appid');
const discoverQuery = document.getElementById('discover-query');
const btnDiscover = document.getElementById('btn-discover');
const btnSearch = document.getElementById('btn-search');
const discoverTbody = document.querySelector('#discover-table tbody');


let currentConfig = null;

async function chooseFile() {
  const res = await window.api.chooseFile();
  if (res.canceled) return;
  filepathSpan.textContent = res.path;
  await loadConfig();
}

async function loadConfig() {
  const res = await window.api.loadConfig();
  if (!res.ok) {
    alert('Failed to load file: ' + (res.error || 'unknown'));
    return;
  }
  currentConfig = res.config;
  filepathSpan.textContent = res.path;
  renderSteam(currentConfig.steam);
  renderDlc(currentConfig.dlc);
}

function renderSteam(steam) {
  appidInput.value = steam.appid || '';
  const unlocked = (steam.unlockall === 'true' || steam.unlockall === true);
  unlockCheckbox.checked = unlocked;
}

function renderDlc(dlc) {
  dlcTbody.innerHTML = '';
  const q = (search.value || '').toLowerCase();

  Object.entries(dlc).forEach(([id, name]) => {
    if (q && !id.toLowerCase().includes(q) && !name.toLowerCase().includes(q)) return;

    const tr = document.createElement('tr');
    const tdId = document.createElement('td'); tdId.textContent = id; tr.appendChild(tdId);
    const tdName = document.createElement('td'); tdName.textContent = name; tr.appendChild(tdName);
    const tdActions = document.createElement('td');
    const rm = document.createElement('button');
    rm.textContent = 'Remove';
    rm.className = 'danger';
    rm.onclick = async () => {
      if (!confirm(`Remove DLC ${id} — ${name}?`)) return;
      const r = await window.api.removeDlc(id);
      if (!r.ok) { alert('Error: '+r.error); return; }
      await loadConfig();
    };
    tdActions.appendChild(rm);
    tr.appendChild(tdActions);
    dlcTbody.appendChild(tr);
  });
}

addBtn.addEventListener('click', async () => {
  const id = newId.value.trim();
  const name = newName.value.trim();
  if (!id || !name) return alert('Both id and name required');
  const res = await window.api.addDlc(id, name);
  if (!res.ok) return alert('Error: ' + res.error);
  newId.value = ''; newName.value = '';
  await loadConfig();
});

chooseBtn.addEventListener('click', chooseFile);
saveUnlockBtn.addEventListener('click', async () => {
  const val = unlockCheckbox.checked ? 'true' : 'false';
  const res = await window.api.updateSteamField('unlockall', val);
  if (!res.ok) alert('Error: ' + res.error);
  else loadConfig();
});

search.addEventListener('input', () => {
  if (currentConfig) renderDlc(currentConfig.dlc);
});




//---------------- STEAM DLC EVENT LISTENERS ----------------//
btnDiscover.addEventListener('click', doDiscoverByAppId);
btnSearch.addEventListener('click', doSearchByName);





//---------------- DLC Discovery/Search ----------------//
function renderDiscoverList(list) {
  discoverTbody.innerHTML = '';
  list.forEach(item => {
    const tr = document.createElement('tr');

    const tdId = document.createElement('td'); tdId.textContent = item.appid; tr.appendChild(tdId);
    const tdName = document.createElement('td'); tdName.textContent = item.name; tr.appendChild(tdName);
    const tdRel = document.createElement('td'); tdRel.textContent = item.release_date || ''; tr.appendChild(tdRel);
    const tdPrice = document.createElement('td'); tdPrice.textContent = item.price || ''; tr.appendChild(tdPrice);

    const tdAct = document.createElement('td');
    const add = document.createElement('button');
    add.textContent = 'Add';
    add.onclick = async () => {
      const res = await window.api.addDlc(item.appid, item.name);
      if (!res.ok) return alert('Error: ' + res.error);
      await loadConfig(); // refresh your local DLC table
    };
    tdAct.appendChild(add);
    tr.appendChild(tdAct);

    discoverTbody.appendChild(tr);
  });
}

async function doDiscoverByAppId() {
  const appid = (discoverAppId.value || '').trim();
  if (!appid) return alert('Enter a base AppID');
  discoverTbody.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';
  const res = await window.api.discoverDlcByAppId(appid);
  if (!res.ok) return alert(res.error || 'Failed');
  renderDiscoverList(res.list);
}

async function doSearchByName() {
  const q = (discoverQuery.value || '').trim();
  if (!q) return alert('Enter a search term');
  discoverTbody.innerHTML = '<tr><td colspan="5">Searching…</td></tr>';
  const res = await window.api.searchDlcByName(q);
  if (!res.ok) return alert(res.error || 'Failed');
  renderDiscoverList(res.list);
}

//---------------- DLC Discovery/Search END ----------------//




// Load default file on start (if exists)
loadConfig();
