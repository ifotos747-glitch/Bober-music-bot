'use strict';
// BOBER 4.0.1: jeden krótki test dostępności strumienia yt-dlp na IP hostingu.
// Bez plików cookies, tokenów OAuth, zapisu audio na dysku i logów URL.
// --test pobiera wyłącznie niewielki fragment; powodzenie nie gwarantuje całego odtwarzania.
const { spawn } = require('node:child_process');
const { classifySource, getYtdlpPath, youtubeArgs, classifyYoutubeFailure } = require('./media');
const DEFAULT_VIDEO = 'https://www.youtube.com/watch?v=o54P8p-2LDk';
function summarize(stderr, code, bytes, timedOut) {
  if (timedOut) return { type:'timeout', message:'yt-dlp przekroczył limit czasu. Sprawdź obciążenie i połączenie hostingu.' };
  const classified = classifyYoutubeFailure(stderr);
  if (classified.type !== 'other') return classified;
  if (code === 0 && bytes > 0) return { type:'ok', message:'Krótki test pobrania fragmentu audio zakończony sukcesem. Nie gwarantuje to pełnego odtwarzania.' };
  if (code === 0 && bytes === 0) return { type:'empty', message:'yt-dlp zakończył test bez danych audio.' };
  if (/unsupported url|invalid url|urlopen error/i.test(stderr))
    return { type:'network', message:'Błędny adres lub problem sieciowy hostingu.' };
  if (/challenge.*(solver|failed)|js runtime|no supported javascript runtime|ejs/i.test(stderr))
    return { type:'js', message:'Sprawdź, czy Node.js i komponenty EJS są dostępne dla yt-dlp na hostingu.' };
  return { type:'other', message:'yt-dlp zgłosił błąd. Sprawdź status narzędzi, IP i dostępność filmu.' };
}
async function diagnose(link = DEFAULT_VIDEO, options = {}) {
  const video = classifySource(link);
  if (video.kind !== 'youtube') throw new Error('Podaj bezpośredni link YouTube.');
  const forced = process.env.YOUTUBE_FORCE_IPV4 === '1';
  const client = (process.env.YOUTUBE_PLAYER_CLIENT || '').trim();
  const args = [
    ...youtubeArgs(client),
    '--test', '--no-simulate', '--no-part', '--retries', '0', '--fragment-retries', '0',
    '-f', process.env.YOUTUBE_FORMAT || 'bestaudio/best',
    '-o', '-', video.source,
  ];
  const spawnImpl = options.spawnImpl || spawn;
  const timeoutMs = Math.max(1, Math.min(45000, options.timeoutMs || 35000));
  return new Promise(resolve => {
    let processYt, bytes = 0, stderr = '', settled = false, timer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, ipv4:forced, client:client || 'domyślny', bytes });
    };
    try {
      processYt = spawnImpl(getYtdlpPath(), args, { stdio:['ignore','pipe','pipe'], windowsHide:true });
    } catch (e) {
      return finish({ type:'spawn', message:'Nie udało się uruchomić yt-dlp: ' + (e.code || 'błąd uruchamiania') });
    }
    timer = setTimeout(() => {
      processYt.kill();
      finish(summarize(stderr, null, bytes, true));
    }, timeoutMs);
    processYt.stdout.on('data', chunk => { bytes += chunk.length; });
    processYt.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-6000); });
    processYt.once('error', err => finish({ type:'spawn', message:'Nie można uruchomić yt-dlp: ' + (err.code || 'błąd narzędzia') }));
    processYt.once('close', code => finish(summarize(stderr, code, bytes, false)));
  });
}
module.exports = { DEFAULT_VIDEO, diagnose, summarize };
