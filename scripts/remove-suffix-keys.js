const fs = require('fs');
const path = require('path');

function removeSuffixes(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.endsWith('_en') || key.endsWith('_es')) continue;
    result[key] = removeSuffixes(value);
  }
  return result;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1) {
    console.log('Skipping', filePath);
    return;
  }
  const obj = eval('(' + content.slice(start, end + 1) + ')');
  const cleaned = removeSuffixes(obj);
  const out = 'module.exports = ' + JSON.stringify(cleaned, null, 2) + ';\n';
  fs.writeFileSync(filePath, out, 'utf8');
  console.log('Cleaned', filePath);
}

for (const f of ['es/quickstart.js', 'es/setup.js']) {
  processFile(path.join(__dirname, '..', 'src', 'locales', 'modules', f));
}
