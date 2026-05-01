const fs = require('fs');
const path = require('path');

const enDir = path.join(__dirname, '..', 'src', 'locales', 'modules', 'en');
const files = fs.readdirSync(enDir).sort();

for (const f of files) {
  const txt = fs.readFileSync(path.join(enDir, f), 'utf8');
  const matches = [...txt.matchAll(/\b(\w+_es)\b/g)];
  if (matches.length) {
    console.log(`${f}: ${[...new Set(matches.map(m => m[1]))].join(', ')}`);
  }
}
console.log('Done');
