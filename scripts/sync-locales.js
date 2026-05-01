const fs = require('fs');
const path = require('path');

function removeSuffixKeys(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.endsWith('_en') || key.endsWith('_es')) continue;
    result[key] = removeSuffixKeys(value);
  }
  return result;
}

function deepMergeKeys(target, source) {
  if (typeof target !== 'object' || target === null || Array.isArray(target)) {
    return target !== undefined ? target : source;
  }
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    return target !== undefined ? target : source;
  }
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (!(key in result)) {
      result[key] = source[key];
    } else {
      result[key] = deepMergeKeys(result[key], source[key]);
    }
  }
  return result;
}

function sortKeys(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj;
  const result = {};
  for (const key of Object.keys(obj).sort()) {
    result[key] = sortKeys(obj[key]);
  }
  return result;
}

function serialize(obj) {
  const json = JSON.stringify(sortKeys(obj), null, 2);
  return 'module.exports = ' + json + ';\n';
}

function loadFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1) return {};
  try {
    return eval('(' + content.slice(start, end + 1) + ')');
  } catch (e) {
    console.log('Parse error:', filePath, e.message);
    return {};
  }
}

const enDir = path.join(__dirname, '..', 'src', 'locales', 'modules', 'en');
const esDir = path.join(__dirname, '..', 'src', 'locales', 'modules', 'es');

const enFiles = fs.readdirSync(enDir).filter(f => f.endsWith('.js')).sort();
const esFiles = fs.readdirSync(esDir).filter(f => f.endsWith('.js')).sort();
const allFiles = new Set([...enFiles, ...esFiles]);

let enAdded = 0;
let esAdded = 0;
let enRemoved = 0;
let esRemoved = 0;

for (const f of allFiles) {
  const enPath = path.join(enDir, f);
  const esPath = path.join(esDir, f);
  const enExists = fs.existsSync(enPath);
  const esExists = fs.existsSync(esPath);

  let enObj = enExists ? loadFile(enPath) : {};
  let esObj = esExists ? loadFile(esPath) : {};

  const enBefore = JSON.stringify(enObj);
  const esBefore = JSON.stringify(esObj);

  enObj = removeSuffixKeys(enObj);
  esObj = removeSuffixKeys(esObj);

  const merged = deepMergeKeys(deepMergeKeys({}, enObj), esObj);
  const newEn = deepMergeKeys({}, merged);
  const newEs = deepMergeKeys({}, merged);

  // For keys that only existed in one side, keep that side's value in both.
  // We already merged, so newEn and newEs have same keys.
  // But we need to preserve original values where both existed.
  // The merge above gave both the same values. Let's fix that.
  function restoreOriginals(target, original) {
    if (typeof target !== 'object' || target === null || Array.isArray(target)) return;
    for (const key of Object.keys(target)) {
      if (key in original) {
        if (typeof original[key] === 'object' && original[key] !== null && !Array.isArray(original[key])) {
          restoreOriginals(target[key], original[key]);
        } else {
          target[key] = original[key];
        }
      }
    }
  }

  restoreOriginals(newEn, enObj);
  restoreOriginals(newEs, esObj);

  // Any key still missing in one side after restore gets the other's value.
  function fillMissing(target, source) {
    if (typeof target !== 'object' || target === null || Array.isArray(target)) return;
    for (const key of Object.keys(target)) {
      if (typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
        fillMissing(target[key], source[key] || {});
      } else if (!(key in target)) {
        // handled by merge already
      }
    }
  }
  fillMissing(newEn, newEs);
  fillMissing(newEs, newEn);

  const enAfter = JSON.stringify(newEn);
  const esAfter = JSON.stringify(newEs);

  if (enBefore !== enAfter) {
    fs.writeFileSync(enPath, serialize(newEn), 'utf8');
    enAdded++;
  }
  if (esBefore !== esAfter) {
    fs.writeFileSync(esPath, serialize(newEs), 'utf8');
    esAdded++;
  }
}

console.log(`Synced ${enAdded} EN files and ${esAdded} ES files.`);
console.log('Done.');
