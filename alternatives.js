'use strict';
// Legalnie dostępne, wskazane przez administratora źródła zastępcze (bez cookies Google).
const fs = require('node:fs');
const path = require('node:path');
const { classifySource } = require('./media');
const DIR = process.env.BOBER_ALTERNATIVES_DATA_DIR || path.join(__dirname, '..', 'data');
const LIMIT = 80;
function guildFile(guildId) {
  if (!/^\d{15,24}$/.test(String(guildId))) throw new Error('Niepoprawny identyfikator serwera.');
  return path.join(DIR, `alternatives-${guildId}.json`);
}
function normalizeKey(input) {
  const raw = String(input || '').trim();
  if (!raw || raw.length > 500) throw new Error('Źródło ma mieć 1–500 znaków.');
  const source = classifySource(raw);
  if (source.kind === 'spotify') {
    const u = new URL(source.source);
    const match = u.pathname.match(/\/track\/([A-Za-z0-9]+)/);
    if (!match) throw new Error('Nieprawidłowy link Spotify do utworu.');
    return `spotify:${match[1]}`;
  }
  if (source.kind === 'youtube') {
    const u = new URL(source.source);
    const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1).split('/')[0] :
      (u.searchParams.get('v') || u.pathname.match(/\/(?:shorts|live|embed)\/([^/?]+)/)?.[1] || '');
    if (!/^[\w-]{11}$/.test(id)) throw new Error('Wpisz bezpośredni link do pojedynczego filmu YouTube.');
    return `youtube:${id}`;
  }
  if (source.kind === 'query') return `query:${source.source.toLocaleLowerCase('pl').replace(/\s+/g, ' ')}`;
  throw new Error('Źródło ma być linkiem Spotify, YouTube albo tytułem utworu.');
}
function validateAudio(value) {
  const found = classifySource(value);
  if (!['file', 'radio'].includes(found.kind)) {
    throw new Error('Alternatywa musi być plikiem z music/ (np. utwor.mp3) albo bezpośrednim publicznym strumieniem audio.');
  }
  return found;
}
function read(guildId) {
  const file = guildFile(guildId);
  if (!fs.existsSync(file)) return {};
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return data && data.sources && typeof data.sources === 'object' && !Array.isArray(data.sources) ? data.sources : {};
}
function saveFile(guildId, sources) {
  fs.mkdirSync(DIR, { recursive: true });
  const target = guildFile(guildId);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, sources }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, target);
}
function add(guildId, source, audio) {
  const key = normalizeKey(source);
  const alt = validateAudio(audio);
  const sources = read(guildId);
  if (!sources[key] && Object.keys(sources).length >= LIMIT) throw new Error(`Limit ${LIMIT} źródeł zastępczych.`);
  sources[key] = { original: String(source).trim(), audio: alt.source, kind: alt.kind };
  saveFile(guildId, sources);
  return { key, ...sources[key] };
}
function find(guildId, source) {
  const saved = read(guildId)[normalizeKey(source)];
  if (!saved) return null;
  // Weryfikacja ponownie przy odtwarzaniu: plik mógł zostać usunięty.
  const track = validateAudio(saved.audio);
  return { ...track, title: `🎵 Zapisana alternatywa: ${String(saved.original).slice(0, 90)}`, alternativeOf: saved.original };
}
function remove(guildId, source) {
  const key = normalizeKey(source);
  const saved = read(guildId);
  if (!saved[key]) throw new Error('Brak takiej alternatywy.');
  delete saved[key];
  saveFile(guildId, saved);
}
function list(guildId) {
  return Object.entries(read(guildId)).map(([key, value]) => ({ key, ...value }));
}
module.exports = { LIMIT, normalizeKey, validateAudio, add, find, remove, list };
