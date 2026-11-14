// BOBER MUSIC BOT 4.0 — integralność wdrożenia i bezpieczny start
'use strict';
require('dotenv').config({ path: require('node:path').join(__dirname, '.env') });
const fs = require('node:fs');
const path = require('node:path');
const packageInfo = require('./package.json');
const required = [
  ['src/index.js', 'BOBER MUSIC BOT 4.0'],
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
console.log(`🎵 START BOBER MUSIC BOT ${packageInfo.version} | ${__filename}`);
for (const [filename, marker] of required) {
  const absolute = path.join(__dirname, filename);
  if (!fs.existsSync(absolute) || !fs.readFileSync(absolute, 'utf8').includes(marker)) {
    console.error(`❌ STARA LUB NIEPEŁNA AKTUALIZACJA: ${filename}`);
    console.error('⛔ Rozpakuj ponownie repozytorium GitHub 4.0 lub ZIP 4.0 bezpośrednio w głównym katalogu hostingu i NADPISZ pliki src/*.js i index.js.');
    process.exit(1);
  }
}
console.log('🔧 WISPBYTE START FIX 1');
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
main().catch(error => { console.error('❌ Błąd startu ' + packageInfo.version + ':', error.message); process.exitCode = 1; });
