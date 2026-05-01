const fs = require('fs');
const path = require('path');

function getKeys(obj, prefix = '') {
  const keys = new Set();
  if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
    for (const k of Object.keys(obj)) {
      const full = prefix ? `${prefix}.${k}` : k;
      keys.add(full);
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        for (const sub of getKeys(obj[k], full)) keys.add(sub);
      }
    }
  }
  return keys;
}

function loadKeys(dir) {
  const result = {};
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.js')) continue;
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end === -1) continue;
    try {
      const obj = eval('(' + content.slice(start, end + 1) + ')');
      result[f] = getKeys(obj);
    } catch (e) {
      result[f] = new Set();
      console.log('Parse error:', f, e.message);
    }
  }
  return result;
}

const enDir = path.join(__dirname, '..', 'src', 'locales', 'modules', 'en');
const esDir = path.join(__dirname, '..', 'src', 'locales', 'modules', 'es');

const enKeys = loadKeys(enDir);
const esKeys = loadKeys(esDir);

const enFiles = Object.keys(enKeys).sort();
const esFiles = Object.keys(esKeys).sort();

console.log('=== File comparison ===');
const allFiles = new Set([...enFiles, ...esFiles]);
for (const f of [...allFiles].sort()) {
  const inEn = enFiles.includes(f);
  const inEs = esFiles.includes(f);
  if (inEn && inEs) {
    const onlyEn = [...enKeys[f]].filter(k => !esKeys[f].has(k));
    const onlyEs = [...esKeys[f]].filter(k => !enKeys[f].has(k));
    if (onlyEn.length || onlyEs.length) {
      console.log(`\n${f}:`);
      if (onlyEn.length) console.log('  Only in EN:', onlyEn.join(', '));
      if (onlyEs.length) console.log('  Only in ES:', onlyEs.join(', '));
    }
  } else if (inEn) {
    console.log(`\n${f}: missing in ES`);
  } else {
    console.log(`\n${f}: missing in EN`);
  }
}

console.log('\nDone.');
