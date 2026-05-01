const fs = require('fs');
const path = require('path');

const esDir = path.join(__dirname, '..', 'src', 'locales', 'modules', 'es');
const files = fs.readdirSync(esDir).sort();

for (const f of files) {
  const txt = fs.readFileSync(path.join(esDir, f), 'utf8');
  const matches = [...txt.matchAll(/\b(\w+_en)\b/g)];
  if (matches.length) {
    console.log(`${f}: ${matches.map(m => m[1]).join(', ')}`);
  }
}
console.log('Done');
