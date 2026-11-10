'use strict';
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '..', 'data');
function getFile(guildId) {
  if (!/^\d{15,24}$/.test(String(guildId))) throw new Error('Błędny serwer.');
  return path.join(dir, `${guildId}.json`);
}
function readData(guildId) {
  const file = getFile(guildId);
  if (!fs.existsSync(file)) return { playlists: {} };
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { playlists: data.playlists && typeof data.playlists === 'object' ? data.playlists : {} };
}
function writeData(guildId, data) {
  fs.mkdirSync(dir, { recursive: true });
  const file = getFile(guildId);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}
function normalizeName(value) {
  const name = String(value).trim();
  if (!/^[\p{L}\p{N} _-]{1,40}$/u.test(name)) throw new Error('Nazwa: 1–40 znaków (litery, cyfry, spacje, _ i -).');
  return name;
}
function save(guildId, name, tracks) {
  name = normalizeName(name);
  if (!tracks.length) throw new Error('Brak utworów do zapisania.');
  if (tracks.length > 100) throw new Error('Można zapisać maksymalnie 100 utworów.');
  const data = readData(guildId);
  if (!data.playlists[name] && Object.keys(data.playlists).length >= 20) throw new Error('Limit 20 playlist na serwer.');
  data.playlists[name] = tracks.map(t => ({ kind: t.kind, source: t.source, title: t.title }));
  writeData(guildId, data);
  return tracks.length;
}
function load(guildId, name) {
  name = normalizeName(name);
  const tracks = readData(guildId).playlists[name];
  if (!Array.isArray(tracks)) throw new Error('Nie znaleziono playlisty.');
  return tracks.map(t => ({ ...t }));
}
function remove(guildId, name) {
  name = normalizeName(name);
  const data = readData(guildId);
  if (!data.playlists[name]) throw new Error('Nie znaleziono playlisty.');
  delete data.playlists[name];
  writeData(guildId, data);
}
function list(guildId) {
  const playlists = readData(guildId).playlists;
  return Object.entries(playlists).map(([name, tracks]) => ({ name, count: tracks.length }));
}
module.exports = { normalizeName, save, load, remove, list };
