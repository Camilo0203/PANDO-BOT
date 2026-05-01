const fs = require('fs');
const path = require('path');

function removeSuffixKeys(obj, suffix) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.endsWith(suffix)) continue;
    result[key] = removeSuffixKeys(value, suffix);
  }
  return result;
}

function cleanFile(filePath, suffix) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Extract the exported object by finding the first { and last }
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1) {
    console.log('Skipping (no object):', filePath);
    return;
  }
  let obj;
  try {
    obj = eval('(' + content.slice(start, end + 1) + ')');
  } catch (e) {
    console.log('Parse error in:', filePath, e.message);
    return;
  }
  const cleaned = removeSuffixKeys(obj, suffix);
  const newContent = 'module.exports = ' + JSON.stringify(cleaned, null, 2) + ';\n';
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Cleaned:', filePath);
}

const esDir = path.join(__dirname, '..', 'src', 'locales', 'modules', 'es');
const enDir = path.join(__dirname, '..', 'src', 'locales', 'modules', 'en');

for (const f of fs.readdirSync(esDir)) {
  if (f.endsWith('.js')) cleanFile(path.join(esDir, f), '_en');
}
for (const f of fs.readdirSync(enDir)) {
  if (f.endsWith('.js')) cleanFile(path.join(enDir, f), '_es');
}

console.log('Done cleaning suffix keys.');
