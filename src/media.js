'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const MUSIC_DIR = path.join(ROOT, 'music');
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.opus', '.flac', '.m4a', '.aac', '.webm']);
const YT_DOMAINS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const SPOTIFY_DOMAINS = new Set(['open.spotify.com']);
function listFiles() {
  if (!fs.existsSync(MUSIC_DIR)) return [];
  return fs.readdirSync(MUSIC_DIR).filter(name => AUDIO_EXT.has(path.extname(name).toLowerCase()) && fs.statSync(path.join(MUSIC_DIR, name)).isFile()).sort();
}
function isPrivateHost(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (['::', '::1'].includes(h) || /^(fc|fd|fe80):/i.test(h) || h.includes(':') || /^0x/i.test(h)) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const a = h.split('.').map(Number);
    return a.some(n => n > 255) || a[0] === 0 || a[0] === 10 || a[0] === 127 || a[0] >= 224 ||
      (a[0] === 169 && a[1] === 254) || (a[0] === 192 && a[1] === 168) ||
      (a[0] === 172 && a[1] >= 16 && a[1] <= 31) || (a[0] === 100 && a[1] >= 64 && a[1] <= 127);
  }
  return /^\d+$/.test(h); // nietypowe reprezentacje adresów IPv4
}
function classifySource(value) {
  const source = String(value).trim();
  if (!source || source.length > 500) throw new Error('Podaj źródło (maks. 500 znaków).');
  if (/^https?:\/\//i.test(source)) {
    let url;
    try { url = new URL(source); } catch { throw new Error('Niepoprawny URL.'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || isPrivateHost(url.hostname)) throw new Error('Dozwolony jest tylko publiczny adres HTTP(S).');
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (YT_DOMAINS.has(host)) return { kind: 'youtube', source: url.href };
    if (SPOTIFY_DOMAINS.has(host)) {
      if (!/^\/(intl-[a-z]{2}\/)?track\/[A-Za-z0-9]+/.test(url.pathname)) throw new Error('Spotify: obsługiwane są tylko linki do pojedynczych utworów (track).');
      return { kind: 'spotify', source: url.href };
    }
    return { kind: 'radio', source: url.href, title: `🌐 ${host}${decodeURIComponent(url.pathname).slice(0, 65)}` };
  }
  if (AUDIO_EXT.has(path.extname(source).toLowerCase()) && !source.includes('/') && !source.includes('\\') && source === path.basename(source)) {
    const full = path.join(MUSIC_DIR, source);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) throw new Error(`Nie ma pliku ${source} w folderze music/.`);
    return { kind: 'file', source: path.basename(source), title: `🎵 ${source}` };
  }
  if (source.includes('/') || source.includes('\\')) throw new Error('Wpisz tytuł, plik z music/ albo publiczny URL.');
  return { kind: 'query', source };
}
function getYtdlpPath() {
  if (process.env.YTDLP_PATH?.trim()) return process.env.YTDLP_PATH.trim();
  const file = path.join(ROOT, 'tools', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp_linux');
  return fs.existsSync(file) ? file : 'yt-dlp';
}
function getFFmpegPath() {
  if (process.env.FFMPEG_PATH?.trim()) return process.env.FFMPEG_PATH.trim();
  try { const ff = require('ffmpeg-static'); if (ff && fs.existsSync(ff)) return ff; } catch { /* fallback */ }
  return 'ffmpeg';
}
// yt-dlp requires EJS challenge scripts for some YouTube player requests.
// GitHub remote components are loaded by yt-dlp itself, no account cookies.
const baseYtArgs = ['--ignore-config', '--no-playlist', '--no-progress', '--no-warnings', '--socket-timeout', '15', '--js-runtimes', 'node', '--remote-components', 'ejs:github'];
const ALT_YT_CLIENTS = 'web_safari,web_embedded';
function youtubeArgs(client = '') {
  // Test opcji IPv4: nie obchodzi blokad YouTube, ale pomaga wykryć problemy
  // z różną reputacją IPv4/IPv6 hostingu. Domyślnie bez zmian.
  const args = [...baseYtArgs, ...(process.env.YOUTUBE_FORCE_IPV4 === '1' ? ['--force-ipv4'] : [])];
  if (!client) return args;
  if (!/^[a-z_]+(?:,[a-z_]+)*$/.test(client)) throw new Error('Niepoprawne YOUTUBE_PLAYER_CLIENT.');
  return [...args, '--extractor-args', `youtube:player_client=${client}`];
}
function isYoutubeChallenge(log) {
  return /sign in to confirm|not a bot|unable to extract.*(challenge|player)|http error 429/i.test(String(log));
}


async function probeTool(command, args = ['-version'], timeout = 7000) {
  return new Promise(resolve => {
    let output = '', stderr = '', done = false;
    let child;
    const finish = (result) => { if (!done) { done = true; clearTimeout(timer); resolve(result); } };
    try { child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); }
    catch (e) { return resolve({ ok: false, message: e.message }); }
    const timer = setTimeout(() => { child.kill(); finish({ ok: false, message: 'Przekroczony czas oczekiwania' }); }, timeout);
    child.stdout.on('data', c => { output = (output + c.toString()).slice(0, 600); });
    child.stderr.on('data', c => { stderr = (stderr + c.toString()).slice(0, 500); });
    child.on('error', e => finish({ ok: false, message: e.code || e.message }));
    child.on('close', code => finish({ ok: code === 0, message: code === 0 ? (output.split('\n')[0] || 'OK') : (stderr.slice(-200) || `Exit code ${code}`) }));
  });
}
async function ensureAudioTools(trackKind) {
  const ffmpeg = await probeTool(getFFmpegPath(), ['-version']);
  if (!ffmpeg.ok) throw new Error(`FFmpeg nie działa (${ffmpeg.message}). Nie dołączam do kanału bez dźwięku. Sprawdź /status i instalację ffmpeg-static.`);
  if (trackKind === 'youtube') {
    const yt = await probeTool(getYtdlpPath(), ['--version']);
    if (!yt.ok) throw new Error(`yt-dlp nie działa (${yt.message}). Sprawdź /status i log pobierania.`);
  }
}

function extractMetadataOnce(input, client = '') {
  return new Promise((resolve, reject) => {
    const args = [...youtubeArgs(client), '--dump-single-json', '--skip-download', input];
    const p = spawn(getYtdlpPath(), args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '', errors = '', finished = false;
    const timer = setTimeout(() => { p.kill(); finish(new Error('YouTube nie odpowiedział w ciągu 50 s.')); }, 50_000);
    function finish(error, info) { if (finished) return; finished = true; clearTimeout(timer); if (error) reject(error); else resolve(info); }
    p.stdout.on('data', c => { out += c; if (out.length > 4_000_000) { p.kill(); finish(new Error('Zbyt długa odpowiedź wyszukiwarki.')); } });
    p.stderr.on('data', c => { errors = (errors + c.toString()).slice(-900); });
    p.on('error', e => finish(new Error(`Brak yt-dlp (${e.code || e.message}). Sprawdź /status oraz instalację yt-dlp.`)));
    p.on('close', code => {
      if (finished) return;
      if (code !== 0) {
        const err = new Error(`Nie udało się pobrać danych YouTube: ${errors.replace(/https?:\/\/\S+/g, '[URL]').slice(-250) || 'serwer odrzucił żądanie'}`);
        err.youtubeChallenge = isYoutubeChallenge(errors);
        return finish(err);
      }
      try {
        const data = JSON.parse(out);
        const first = Array.isArray(data.entries) ? data.entries.find(Boolean) : data;
        const link = first.webpage_url || first.original_url || first.url;
        const parsed = new URL(link);
        if (!YT_DOMAINS.has(parsed.hostname.toLowerCase())) throw new Error('Wyszukiwarka nie zwróciła poprawnego linku YouTube.');
        finish(null, { kind: 'youtube', source: parsed.href, title: String(first.title || 'Utwór z YouTube').slice(0, 160), youtubeClient: client || '' });
      } catch (e) { finish(new Error(`Nie można odczytać wyniku YouTube: ${e.message}`)); }
    });
  });
}
async function extractMetadata(input) {
  const preferred = (process.env.YOUTUBE_PLAYER_CLIENT || '').trim();
  try { return await extractMetadataOnce(input, preferred); }
  catch (first) {
    if (!first.youtubeChallenge || preferred) throw first;
    console.warn('[YOUTUBE] YouTube odrzucił domyślnego klienta. Próba alternatywnych klientów bez cookies.');
    try { return await extractMetadataOnce(input, ALT_YT_CLIENTS); }
    catch (second) {
      if (second.youtubeChallenge) throw new Error('YouTube wymaga potwierdzenia sesji lub blokuje IP tego hostingu. Alternatywny klient też nie zadziałał. Użyj /radio lub MP3; nie przesyłaj plików cookies ze swojego konta na hosting.');
      throw second;
    }
  }
}
async function spotifyTitle(link) {
  // Jeśli skonfigurowano Spotify Web API, preferuj oficjalne metadane.
  // Na HTTP 403 i ograniczeniach Dev Mode bezpiecznie wróć do oEmbed.
  const spotifyApi = require('./spotify-api');
  if (spotifyApi.config().ready) {
    try {
      const result = await spotifyApi.getTrack(link);
      return {title:result.title, artist:result.artist};
    } catch {
      console.warn('[SPOTIFY] Web API niedostępne, ponawiam przez publiczny oEmbed.');
    }
  }
  const url = 'https://open.spotify.com/oembed?url=' + encodeURIComponent(link);
  const res = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Spotify nie zwróciło tytułu utworu (HTTP ${res.status}).`);
  const data = await res.json();
  if (!data.title || typeof data.title !== 'string') throw new Error('Spotify nie podało tytułu.');
  return { title: data.title.slice(0, 120), artist: typeof data.author_name === 'string' ? data.author_name.slice(0, 120) : '' };
}
function normalizeMusicTitle(text) {
  return String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pl').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
function findLocalSpotifyTrack(title, artist = '') {
  const name = normalizeMusicTitle(title);
  const who = normalizeMusicTitle(artist);
  if (name.length < 6) return null; // bez mylenia krótkich tytułów
  const matches = listFiles().filter(file => {
    const base = normalizeMusicTitle(path.parse(file).name);
    return base === name || (who && (base === `${who} ${name}` || base === `${name} ${who}`));
  });
  if (matches.length !== 1) return null; // nie odtwarzaj przypadkowej piosenki
  return { kind: 'file', source: matches[0], title: `🎵 ${title} (music/)`, resolvedFrom: 'spotify-local' };
}
function classifyYoutubeFailure(log) {
  const s = String(log || '');
  if (/sign in to confirm|not a bot|login.required|captcha/i.test(s))
    return { type: 'login', message: 'YouTube wymaga potwierdzenia sesji z tego hostingu. Nie podawaj cookies. Użyj /alternatywa add lub /radio.' };
  if (/http error 403|403 forbidden|status code: 403/i.test(s))
    return { type: '403', message: 'YouTube zwrócił HTTP 403 przy pobieraniu audio. Źródło może być blokowane przez IP hostingu lub wymagać dodatkowego tokenu. Użyj /alternatywa add lub /radio.' };
  if (/requested format is not available|format.*not available/i.test(s))
    return { type: 'format', message: 'Ten film nie udostępnia wybranego formatu audio. Zmień YOUTUBE_FORMAT lub użyj innego źródła.' };
  if (/private video|video unavailable|not available|age.restricted|members.only/i.test(s))
    return { type: 'unavailable', message: 'Film jest niedostępny, prywatny lub ma ograniczenia dostępu.' };
  return { type: 'other', message: 'yt-dlp nie pobrał audio. Sprawdź konsolę i /status.' };
}
async function resolveTrack(raw, options = {}) {
  const item = classifySource(raw);
  if (item.kind === 'file' || item.kind === 'radio') return item;
  // Mapowanie per serwer Discord. Nie wymaga konta Spotify ani YouTube.
  const alternatives = options.guildId ? require('./alternatives') : null;
  const alt = alternatives?.find(options.guildId, raw);
  if (alt) return alt;
  if (item.kind === 'spotify') {
    const { title, artist } = await spotifyTitle(item.source);
    const matched = findLocalSpotifyTrack(title, artist);
    if (matched) return matched;
    const altTitle = alternatives?.find(options.guildId, title);
    if (altTitle) return altTitle;
    // BOBER MUSIC BOT 3.0 — priorytet bezpośrednich legalnie udostępnionych źródeł.
    const sources = require('./sources');
    let direct = null;
    try { direct = await sources.strictSource(title, artist); }
    catch (error) { console.warn('[ŹRÓDŁA] Nie można sprawdzić katalogów:', error.message); }
    if (direct) return sources.asTrack(direct, item.source);
    if (process.env.BOBER_YOUTUBE_FALLBACK === '1') {
      try {
        const yt = await extractMetadata('ytsearch1:' + [artist, title, 'official audio'].filter(Boolean).join(' '));
        return { ...yt, title: `${title} — ${artist || 'Spotify'} (YouTube)` };
      } catch (error) { console.warn('[SPOTIFY] Opcjonalne YouTube niedostępne:', error.message); }
    }
    throw new Error(`Rozpoznano Spotify: „${title}”${artist ? ' — ' + artist : ''}, ale nie znaleziono JEDNOZNACZNIE tego samego nagrania w dostępnych katalogach. Użyj /zrodla szukaj i /zrodla graj, sprawdź /zrodla status albo /alternatywa add. Nie odtwarzam losowego remixu.`);
  }
  if (item.kind === 'query') {
    const parsed = require('./sources').queryParts(item.source);
    if (parsed.artist) {
      const candidate = await require('./sources').strictSource(parsed.title, parsed.artist).catch(() => null);
      if (candidate) return require('./sources').asTrack(candidate, item.source);
    }
    // Zachowujemy działanie starej komendy /search z YouTube.
    return extractMetadata('ytsearch1:' + item.source);
  }
  // Bez dodatkowego żądania metadanych dla bezpośredniego linku YouTube;
  // na współdzielonych adresach IP samo pobranie metadanych często bywa blokowane.
  // Można włączyć starszą metodę: YOUTUBE_FETCH_METADATA=1.
  if (process.env.YOUTUBE_FETCH_METADATA !== '1') {
    const u = new URL(item.source);
    const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop() || 'film';
    return { ...item, title: `YouTube ${id.slice(0, 30)}` };
  }
  return extractMetadata(item.source);
}
function restoreSaved(item) {
  if (!item || typeof item.source !== 'string') throw new Error('Niepoprawny wpis w playliście.');
  if (item.kind === 'file') return classifySource(item.source);
  if (item.kind === 'stream') {
    const valid = classifySource(item.source);
    if (valid.kind !== 'radio') throw new Error('Nieprawidłowy strumień playlisty.');
    return { kind: 'stream', source:valid.source, title:String(item.title || 'Utwór katalogowy').slice(0,160),
      provider:String(item.provider || '').slice(0,40), attribution:String(item.attribution || '').slice(0,220), page:String(item.page || '').slice(0,350), license:String(item.license || '').slice(0,250) };
  }
  if (item.kind === 'youtube' || item.kind === 'radio') {
    const parsed = classifySource(item.source);
    if (parsed.kind !== item.kind) throw new Error('Błędne źródło playlisty.');
    return { ...parsed, title: String(item.title || parsed.title || 'Utwór').slice(0, 160), ...(item.kind === 'youtube' && typeof item.youtubeClient === 'string' && /^[a-z_]+(?:,[a-z_]+)*$/.test(item.youtubeClient) ? {youtubeClient:item.youtubeClient} : {}) };
  }
  throw new Error('Nieznany typ utworu w playliście.');
}
module.exports = { MUSIC_DIR, classifySource, listFiles, resolveTrack, restoreSaved, getYtdlpPath, getFFmpegPath, baseYtArgs, youtubeArgs, isYoutubeChallenge, classifyYoutubeFailure, findLocalSpotifyTrack, normalizeMusicTitle, probeTool, ensureAudioTools };
