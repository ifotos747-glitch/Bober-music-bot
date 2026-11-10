'use strict';
// BOBER 4.0: prywatna biblioteka ulubionych per serwer + użytkownik Discord.
const fs = require('node:fs');
const path = require('node:path');
const DIR = process.env.BOBER_FAVORITES_DATA_DIR || path.join(__dirname, '..', 'data');
const MAX_FAVORITES = 30;
const ID = /^\d{15,24}$/;
const KINDS = new Set(['file', 'youtube', 'stream', 'radio']);
function file(guildId, userId) {
  if (!ID.test(String(guildId)) || !ID.test(String(userId)))
    throw new Error('Niepoprawny identyfikator Discord.');
  return path.join(DIR, 'favorites-' + guildId + '-' + userId + '.json');
}
function normalize(track) {
  if (!track || !KINDS.has(track.kind) || typeof track.source !== 'string' ||
      track.source.length < 1 || track.source.length > 700)
    throw new Error('Tego utworu nie można dodać do ulubionych.');
  const title = String(track.title || 'Utwór').replace(/[\r\n]/g, ' ').slice(0, 130);
  const result = { kind: track.kind, source: track.source, title };
  if (track.kind === 'stream') {
    for (const k of ['provider', 'attribution', 'page', 'license']) {
      if (typeof track[k] === 'string') result[k] = track[k].slice(0, 250);
    }
  }
  if (track.kind === 'youtube' && typeof track.youtubeClient === 'string' &&
      /^[a-z_]+(?:,[a-z_]+)*$/.test(track.youtubeClient))
    result.youtubeClient = track.youtubeClient;
  return result;
}
function read(guildId, userId) {
  const name = file(guildId, userId);
  if (!fs.existsSync(name)) return [];
  const raw = JSON.parse(fs.readFileSync(name, 'utf8'));
  if (!Array.isArray(raw.tracks)) throw new Error('Uszkodzony plik ulubionych.');
  return raw.tracks.slice(0, MAX_FAVORITES).map(normalize);
}
function write(guildId, userId, tracks) {
  fs.mkdirSync(DIR, { recursive: true });
  const target = file(guildId, userId);
  const tmp = target + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, tracks }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, target);
}
function add(guildId, userId, track) {
  const saved = normalize(track);
  const tracks = read(guildId, userId);
  if (tracks.some(t => t.kind === saved.kind && t.source === saved.source))
    throw new Error('Ten utwór jest już w Twoich ulubionych.');
  if (tracks.length >= MAX_FAVORITES)
    throw new Error('Limit ' + MAX_FAVORITES + ' ulubionych na użytkownika i serwer.');
  tracks.push(saved);
  write(guildId, userId, tracks);
  return { count: tracks.length, track: saved };
}
function at(tracks, number) {
  if (!Number.isInteger(number) || number < 1 || number > tracks.length)
    throw new Error('Nieprawidłowy numer ulubionego utworu (1–' + tracks.length + ').');
  return number - 1;
}
function get(guildId, userId, number) {
  const tracks = read(guildId, userId);
  return { ...tracks[at(tracks, number)] };
}
function remove(guildId, userId, number) {
  const tracks = read(guildId, userId);
  const removed = tracks.splice(at(tracks, number), 1)[0];
  write(guildId, userId, tracks);
  return removed;
}
module.exports = { MAX_FAVORITES, normalize, list: read, add, get, remove };
