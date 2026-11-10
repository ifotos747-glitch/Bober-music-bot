'use strict';
// BOBER MUSIC BOT 3.0 — jawne, legalnie udostępniane strumienie; bez obchodzenia zabezpieczeń.
// Audius: publiczny katalog strumieni udostępnionych przez autorów.
// Jamendo: API z licencjami CC, wymaga JAMENDO_CLIENT_ID.
const { classifySource, normalizeMusicTitle } = require('./media');
const AUDIUS_BASE = 'https://api.audius.co/v1';
const JAMENDO_BASE = 'https://api.jamendo.com/v3.0/tracks/';
const APP_NAME = 'BOBER_MUSIC_BOT_3_0';
const recent = new Map();
const CACHE_MS = 10 * 60 * 1000;
const CATALOG_TTL = 45 * 1000;
// Limit pamięci; nie przechowujemy katalogu audio ani danych uwierzytelniania.
const catalogCache = new Map();
function catalogKey(query) { return query.trim().toLocaleLowerCase('pl'); }
function storeCatalog(key, result) {
  if (catalogCache.size >= 40) catalogCache.delete(catalogCache.keys().next().value);
  catalogCache.set(key, { until: Date.now() + CATALOG_TTL, result });
}


function clean(value) { return String(value || '').replace(/[\r\n`*<>]/g, ' ').trim().slice(0, 130); }
function norm(value) { return normalizeMusicTitle(value); }
function exactMatch(item, title, artist) {
  return norm(item.title) === norm(title) && Boolean(norm(artist)) && norm(item.artist) === norm(artist);
}
function queryParts(query) {
  const value = clean(query);
  const ix = value.indexOf(' - ');
  if (ix > 0 && ix < value.length - 3) return { artist: value.slice(0, ix).trim(), title: value.slice(ix+3).trim() };
  return { artist: '', title: value };
}
function publicHttp(url) {
  try {
    const parsed = classifySource(String(url));
    if (parsed.kind !== 'radio') return null;
    const u = new URL(parsed.source);
    if (u.protocol !== 'https:') return null;
    return parsed.source;
  } catch { return null; }
}
async function getJson(url, fetchImpl = fetch) {
  const resp = await fetchImpl(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`API zwróciło HTTP ${resp.status}`);
  const json = await resp.json();
  if (!json || typeof json !== 'object') throw new Error('API zwróciło niepoprawny JSON');
  return json;
}
function audiusTrack(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' ||
      !/^[A-Za-z0-9_-]{2,40}$/.test(value.id)) return null;
  if (value.is_streamable === false || value.is_unlisted || value.is_premium ||
      value.access?.stream === false || value.access?.type === 'purchase') return null;
  const title = clean(value.title);
  const artist = clean(value.user?.name || value.user?.handle);
  if (!title || !artist) return null;
  const source = `${AUDIUS_BASE}/tracks/${encodeURIComponent(value.id)}/stream?app_name=${APP_NAME}`;
  return { kind:'stream', provider:'Audius', id:value.id, title, artist, source,
    attribution: `Audius — ${artist}: ${title}`,
    page: typeof value.permalink === 'string' && value.permalink.startsWith('/') ? `https://audius.co${value.permalink}` : 'https://audius.co/',
    license: 'API Audius: autor zezwala na streaming przez API; sprawdź prawa do publicznego odtwarzania.' };
}
async function audiusSearch(query, fetchImpl = fetch) {
  if (process.env.AUDIUS_ENABLED === '0') return [];
  const url = new URL(`${AUDIUS_BASE}/tracks/search`);
  url.searchParams.set('query', clean(query));
  url.searchParams.set('limit', '12');
  url.searchParams.set('app_name', APP_NAME);
  const json = await getJson(url.toString(), fetchImpl);
  const data = Array.isArray(json.data) ? json.data : Array.isArray(json.data?.data) ? json.data.data : [];
  return data.map(audiusTrack).filter(Boolean);
}
function jamendoTrack(value) {
  if (!value || !/^\d{1,20}$/.test(String(value.id || ''))) return null;
  const title=clean(value.name), artist=clean(value.artist_name);
  const source=publicHttp(value.audio);
  if (!title || !artist || !source || !/^https?:\/\/creativecommons\.org\/licenses\//i.test(String(value.license_ccurl || ''))) return null;
  return { kind:'stream', provider:'Jamendo', id:String(value.id), title, artist, source,
    attribution:`Jamendo — ${artist}: ${title} (${value.license_ccurl})`,
    page: typeof value.shareurl === 'string' && /^https:\/\/(?:www\.)?jamendo\.com\//i.test(value.shareurl) ? value.shareurl : 'https://www.jamendo.com/',
    license: value.license_ccurl };
}
async function jamendoSearch(query, fetchImpl = fetch) {
  const id = String(process.env.JAMENDO_CLIENT_ID || '').trim();
  if (!id || !/^[A-Za-z0-9]{6,64}$/.test(id)) return [];
  const url = new URL(JAMENDO_BASE);
  url.searchParams.set('client_id', id);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '12');
  url.searchParams.set('search', clean(query));
  url.searchParams.set('include', 'licenses');
  url.searchParams.set('audioformat', 'mp31');
  url.searchParams.set('type', 'single albumtrack');
  const json = await getJson(url.toString(), fetchImpl);
  return (Array.isArray(json.results) ? json.results : []).map(jamendoTrack).filter(Boolean);
}
async function searchCatalog(query, fetchImpl = fetch) {
  const q = clean(query);
  if (q.length < 3 || q.length > 125) throw new Error('Podaj nazwę utworu (3–125 znaków).');
  const cache = fetchImpl === globalThis.fetch;
  const key = catalogKey(q);
  const previous = cache ? catalogCache.get(key) : null;
  if (previous && previous.until > Date.now()) return previous.result;
  const [a, j] = await Promise.allSettled([audiusSearch(q, fetchImpl), jamendoSearch(q, fetchImpl)]);
  const errors = [a,j].filter(x=>x.status==='rejected').map(x=>clean(x.reason?.message));
  const all = [...(a.status==='fulfilled'?a.value:[]), ...(j.status==='fulfilled'?j.value:[])];
  const seen = new Set();
  const results = all.filter(item => { const key=`${item.provider}:${item.id}`; if(seen.has(key))return false;seen.add(key);return true; });
  const result = { results, errors };
  // Błędów usług nie zapisujemy jako długotrwałych wyników.
  if (cache && errors.length === 0) storeCatalog(key, result);
  return result;
}
async function strictSource(title, artist, fetchImpl = fetch) {
  if (!norm(title) || !norm(artist)) return null;
  const primary = await searchCatalog(`${artist} ${title}`, fetchImpl);
  let exact = primary.results.filter(item=>exactMatch(item,title,artist));
  // Niektóre katalogi wyszukują lepiej po tytule niż po "wykonawca tytuł".
  // Drugie zapytanie uruchamiamy wyłącznie, gdy pierwsze nie znalazło dokładnego wyniku.
  if (exact.length === 0 && norm(title).length >= 4) {
    const secondary = await searchCatalog(title, fetchImpl);
    exact = secondary.results.filter(item=>exactMatch(item,title,artist));
  }
  // Dwie kopie o tym samym tytule i wykonawcy mogą nadal być innymi nagraniami.
  return exact.length === 1 ? exact[0] : null;
}
async function checkProviders(fetchImpl = fetch) {
  const responses = await Promise.allSettled([
    process.env.AUDIUS_ENABLED === '0' ? Promise.resolve(null) : audiusSearch('music', fetchImpl),
    process.env.JAMENDO_CLIENT_ID ? jamendoSearch('music', fetchImpl) : Promise.resolve(null),
  ]);
  return ['Audius', 'Jamendo'].map((provider, i) => {
    const r = responses[i];
    if (r.status === 'rejected') return {provider, status:'error', message:clean(r.reason?.message)};
    if (r.value === null) return {provider, status:'disabled', message:i===0?'AUDIUS_ENABLED=0':'Ustaw JAMENDO_CLIENT_ID'};
    return {provider, status:'ok', results:r.value.length};
  });
}
function asTrack(candidate, original = '') {
  if (!candidate || candidate.kind !== 'stream' || !['Audius','Jamendo'].includes(candidate.provider))
    throw new Error('Niepoprawna pozycja w katalogu źródeł.');
  const parsed = publicHttp(candidate.source);
  if (!parsed) throw new Error('Źródło nie jest publicznym strumieniem HTTPS.');
  return { kind:'stream', source:parsed, title:`${candidate.artist} — ${candidate.title} (${candidate.provider})`,
    provider:candidate.provider, attribution:candidate.attribution, page:candidate.page,
    license:candidate.license, original:clean(original) };
}
function saveResults(guildId, userId, results) {
  const ids = results.slice(0, 8).filter(r=>r && r.kind==='stream');
  recent.set(`${guildId}:${userId}`,{at:Date.now(), results:ids});
  return ids;
}
function selectResult(guildId, userId, number) {
  const key=`${guildId}:${userId}`, record=recent.get(key);
  if (!record || Date.now()-record.at>CACHE_MS) { recent.delete(key); throw new Error('Wyszukiwanie wygasło. Użyj ponownie /zrodla szukaj.'); }
  const n=Number(number);
  if (!Number.isInteger(n) || n < 1 || n > record.results.length) throw new Error('Nieprawidłowy numer. Wybierz wynik z /zrodla szukaj.');
  return asTrack(record.results[n-1]);
}
module.exports = { norm, exactMatch, queryParts, publicHttp, audiusTrack, jamendoTrack,
  searchCatalog, strictSource, checkProviders, asTrack, saveResults, selectResult };
