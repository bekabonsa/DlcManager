// iniParser.js
// Functions:
// - parseIniPreserve(rawText) -> { raw, steam: {...}, dlc: {...}, dlcStart, dlcEnd }
// - replaceDlcBlock(rawText, dlcObj) -> newRawText
// - replaceSteamField(rawText, key, value) -> newRawText

function parseIniPreserve(raw) {
  const lines = raw.split(/\r?\n/);
  let section = null;
  const steam = {};
  const dlc = {};

  let dlcStart = -1;
  let dlcEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const secMatch = trimmed.match(/^\[(.+)\]$/);
    if (secMatch) {
      section = secMatch[1].toLowerCase();
      if (section === 'dlc' && dlcStart === -1) {
        dlcStart = i; // inclusive header line index
      } else if (dlcStart !== -1 && section !== 'dlc' && dlcEnd === -1) {
        dlcEnd = i - 1; // previous line was end of dlc
      }
      continue;
    }

    // key = value
    if (trimmed && !trimmed.startsWith(';') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();

      if (section === 'steam') {
        steam[key] = value;
      } else if (section === 'dlc') {
        dlc[key] = value;
      }
    }
  }

  // If file ended while in dlc section, set dlcEnd to last line
  if (dlcStart !== -1 && dlcEnd === -1) dlcEnd = lines.length - 1;

  return { raw, steam, dlc, dlcStart, dlcEnd };
}

function generateDlcBlock(dlcObj) {
  const lines = ['[dlc]'];
  for (const [id, name] of Object.entries(dlcObj)) {
    lines.push(`${id} = ${name}`);
  }
  lines.push(''); // trailing blank line for readability
  return lines.join('\n');
}

function replaceDlcBlock(raw, dlcObj) {
  const lines = raw.split(/\r?\n/);
  const parsed = parseIniPreserve(raw);

  const newDlcBlock = generateDlcBlock(dlcObj);
  const before = lines.slice(0, parsed.dlcStart >= 0 ? parsed.dlcStart : lines.length);
  const after = lines.slice(parsed.dlcEnd >= 0 ? parsed.dlcEnd + 1 : lines.length);

  const combined = before.concat(newDlcBlock.split('\n')).concat(after);
  return combined.join('\n');
}

function replaceSteamField(raw, key, value) {
  const lines = raw.split(/\r?\n/);
  let section = null;
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const secMatch = trimmed.match(/^\[(.+)\]$/);
    if (secMatch) {
      section = secMatch[1].toLowerCase();
      continue;
    }

    if (section === 'steam' && trimmed && !trimmed.startsWith(';')) {
      if (trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const k = trimmed.slice(0, idx).trim();
        if (k === key) {
          lines[i] = `${key} = ${value}`;
          found = true;
          break;
        }
      }
    }
  }

  // if not found, append to the [steam] block (or create one)
  if (!found) {
    // find steam start
    let steamStart = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().match(/^\[steam\]$/i)) {
        steamStart = i;
        break;
      }
    }
    if (steamStart >= 0) {
      // insert after steamStart header line
      lines.splice(steamStart + 1, 0, `${key} = ${value}`);
    } else {
      // prepend a steam block
      lines.unshift('', `${key} = ${value}`, '[steam]');
    }
  }

  return lines.join('\n');
}

module.exports = { parseIniPreserve, replaceDlcBlock, replaceSteamField };
