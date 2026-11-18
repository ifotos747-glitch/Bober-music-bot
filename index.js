// BOBER RADIO 24/7 — integralność wdrożenia i bezpieczny start
'use strict';
require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });
const fs = require('node:fs');
const path = require('node:path');
const packageInfo = require('./package.json');
const required = [
  ['src/index.js', 'BOBER RADIO 24/7'],
  ['src/media.js', 'classifyYoutubeFailure'],
  ['src/queue-tools.js', 'function requeueFinished'],
  ['src/youtube-diagnostics.js', 'function summarize'],
  ['src/favorites.js', 'MAX_FAVORITES = 30'],
  ['src/alternatives.js', 'function normalizeKey(input)'],
  ['src/sources.js', 'async function searchCatalog(query'],
  ['src/player.js', 'diag-ogg-opus-v2.2'],
  ['src/shared.js', "setName('equalizer')"],
  ['src/effects.js', 'function makeFilters(settings)'],
  ['src/radios.js', 'radio-catalog-v2.3'],
  ['src/always247.js', "'silent'"],
];
console.log(`🎵 START BOBER RADIO 24/7 ${packageInfo.version} | ${__filename}`);
for (const [filename, marker] of required) {
  const absolute = path.join(__dirname, filename);
  if (!fs.existsSync(absolute) || !fs.readFileSync(absolute, 'utf8').includes(marker)) {
    console.error(`❌ STARA LUB NIEPEŁNA AKTUALIZACJA: ${filename}`);
    console.error('⛔ Rozpakuj ponownie repozytorium GitHub radio-6.0 lub ZIP 6.0 bezpośrednio w głównym katalogu hostingu i NADPISZ pliki src/*.js i index.js.');
    process.exit(1);
  }
}
console.log('🔧 WISPBYTE START FIX 1');
console.log('🔧 WISPBYTE SYNTAX CHECK 6.0');
const { spawnSync } = require('node:child_process');
const checkFiles = [
  ...fs.readdirSync(path.join(__dirname, 'src')).filter(name => name.endsWith('.js')).map(name => path.join('src', name)),
  ...['tools', '.tools'].flatMap(dir => fs.existsSync(path.join(__dirname, dir)) ? fs.readdirSync(path.join(__dirname, dir)).filter(name => name.endsWith('.js')).map(name => path.join(dir, name)) : []),
];
for (const filename of checkFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(__dirname, filename)], { encoding: 'utf8', timeout: 20000 });
  if (result.status !== 0) {
    console.error('❌ SYNTAX ERROR: ' + filename);
    console.error(result.stderr || result.error?.message || 'Kontrola nie powiodła się.');
    process.exit(1);
  }
}
console.log('✅ Składnia OK: ' + checkFiles.length + ' plików JS.');
async function main() {
  const { register } = require('./src/register');
  await register();
  require('./src/index');
  if (process.env.YTDLP_AUTO_INSTALL !== '0') {
    const candidates = ['tools/install-ytdlp.js', '.tools/install-ytdlp.js'];
    const installer = candidates.find(file => fs.existsSync(path.join(__dirname, file)));
    if (!installer) {
      console.warn('⚠️ Brak instalatora yt-dlp. Wgraj tools/install-ytdlp.js do /home/container/tools/. Radio i inne źródła pozostają dostępne, jeśli ich narzędzia działają.');
      return;
    }
    try {
      const found = await require(path.join(__dirname, installer)).ensureYtdlp();
      console.log('✅ yt-dlp gotowe:', found);
    } catch (error) {
      console.warn('⚠️ yt-dlp niedostępne:', error.message);
    }
  }
}
main().catch(error => { console.error('❌ Błąd startu ' + packageInfo.version + ':', error.stack || error.message); process.exitCode = 1; });
