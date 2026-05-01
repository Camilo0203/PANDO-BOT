const fs = require('fs');
const path = require('path');

const enDir = path.join(__dirname, '..', 'src', 'locales', 'modules', 'en');
const esDir = path.join(__dirname, '..', 'src', 'locales', 'modules', 'es');
const ignore = new Set(['ok','true','false','on','off','yes','no','null','undefined','nan','id','url','api','discord','automod','autmod','pro','free','premium','cpu','ram','json','xml','html','css','npm','node.js','github','gitlab','youtube','twitch','spotify']);

function extractValues(obj, prefix = '') {
  const vals = [];
  if (typeof obj === 'string') {
    vals.push({ k: prefix, v: obj });
  } else if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const k of Object.keys(obj)) {
      vals.push(...extractValues(obj[k], prefix ? prefix + '.' + k : k));
    }
  }
  return vals;
}

function load(file) {
  const c = fs.readFileSync(file, 'utf8');
  const s = c.indexOf('{');
  const e = c.lastIndexOf('}');
  if (s === -1 || e === -1) return {};
  try { return eval('(' + c.slice(s, e + 1) + ')'); } catch { return {}; }
}

for (const f of fs.readdirSync(enDir).filter(x => x.endsWith('.js')).sort()) {
  const en = load(path.join(enDir, f));
  const es = load(path.join(esDir, f));
  const enVals = extractValues(en);
  const esVals = extractValues(es);
  const map = new Map(enVals.map(x => [x.k, x.v]));
  const matches = [];
  for (const { k, v } of esVals) {
    if (map.has(k) && map.get(k) === v) {
      const words = v.toLowerCase().replace(/[^a-z ]/g, ' ').trim().split(/\s+/).filter(Boolean);
      if (words.length && words.every(w => ignore.has(w))) continue;
      if (v.trim().length < 2) continue;
      matches.push(k + ' = ' + JSON.stringify(v).slice(0, 80));
    }
  }
  if (matches.length) {
    console.log(`\n=== ${f} (${matches.length}) ===`);
    for (const m of matches.slice(0, 30)) console.log('  ' + m);
    if (matches.length > 30) console.log('  ... and ' + (matches.length - 30) + ' more');
  }
}
console.log('\nDone.');
