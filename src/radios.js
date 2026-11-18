'use strict'; // radio-catalog-v2.3
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { classifySource } = require('./media');
const STORE_DIR = process.env.BOBER_RADIO_DATA_DIR || path.join(__dirname, '..', 'data');
const MAX_RADIOS = 25;
function guildFile(guildId) {
  if (!/^\d{15,24}$/.test(String(guildId))) throw new Error('Nieprawidłowy identyfikator serwera Discord.');
  return path.join(STORE_DIR, `radios-${guildId}.json`);
}
function read(guildId) {
  const file = guildFile(guildId);
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(data.stations) ? data.stations : [];
}
function write(guildId, stations) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  const file = guildFile(guildId);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, stations }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}
function normalizeName(raw) {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!/^[\p{L}\p{N} ._\-()&+]{1,50}$/u.test(name)) throw new Error('Nazwa stacji: 1–50 znaków; litery, cyfry, spacje i ._-()&+.');
  return name;
}
function normalizeGenre(raw) {
  const genre = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!genre) return 'Różne';
  if (!/^[\p{L}\p{N} ._\-()&+]{1,32}$/u.test(genre)) throw new Error('Gatunek: maksymalnie 32 znaki.');
  return genre;
}
function validAudioUrl(input) {
  const item = classifySource(input);
  if (item.kind !== 'radio') throw new Error('Wprowadź bezpośredni adres strumienia HTTP(S), nie link YouTube, Spotify ani stronę WWW.');
  const url = new URL(item.source);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Stacja musi używać http lub https.');
  return item.source;
}
const globalFile = path.join(STORE_DIR,'radios-global.json');
function globalList() {
  if (!fs.existsSync(globalFile)) return [];
  const data = JSON.parse(fs.readFileSync(globalFile,'utf8'));
  return Array.isArray(data.stations) ? data.stations.map(s=>({...s,global:true})) : [];
}
function writeGlobal(stations) {
  fs.mkdirSync(STORE_DIR,{recursive:true});
  const tmp=globalFile+'.'+process.pid+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify({version:1,stations},null,2),{mode:0o600});
  fs.renameSync(tmp,globalFile);
}
function globalAdd(name,url,genre,country='') {
  const stations=globalList();
  const item={id:'g'+randomBytes(6).toString('hex'),name:normalizeName(name),url:validAudioUrl(url),genre:normalizeGenre(genre),country:String(country).trim().slice(0,40)};
  if(stations.length>=1000) throw new Error('Limit 1000 globalnych stacji.');
  if(stations.some(s=>s.name.toLowerCase()===item.name.toLowerCase() || s.url===item.url)) throw new Error('Stacja już istnieje w katalogu globalnym.');
  stations.push(item);writeGlobal(stations);return item;
}
function globalRemove(key) {
 const stations=globalList(), item=stations.find(s=>s.id===key || s.name.toLowerCase()===String(key).toLowerCase());
 if(!item) throw new Error('Nie znaleziono globalnej stacji.');
 writeGlobal(stations.filter(s=>s.id!==item.id));return item;
}
function list(guildId) { return [...read(guildId).map(s=>({...s})),...globalList()]; }
function search(guildId,query='',genre='',country='',scope='all') {
 const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const words=norm(query).trim().split(/\s+/).filter(Boolean);
 return list(guildId).filter(s=>(scope==='all'||(scope==='global'===Boolean(s.global))) &&
 words.every(w=>norm(s.name+' '+s.genre+' '+(s.country||'')).includes(w)) &&
 norm(s.genre).includes(norm(genre)) && norm(s.country).includes(norm(country)))
 .sort((a,b)=>a.name.localeCompare(b.name,'pl'));
}
function find(guildId, text) {
  const key = String(text || '').trim().toLocaleLowerCase('pl');
  return list(guildId).find(s => s.id === text || s.name.toLocaleLowerCase('pl') === key) || null;
}
function add(guildId, rawName, inputUrl, rawGenre) {
  const name = normalizeName(rawName);
  const genre = normalizeGenre(rawGenre);
  const url = validAudioUrl(inputUrl);
  const stations = read(guildId);
  if (stations.some(s => s.name.toLocaleLowerCase('pl') === name.toLocaleLowerCase('pl'))) throw new Error('Stacja o tej nazwie już istnieje.');
  if (stations.length >= MAX_RADIOS) throw new Error('Limit 25 stacji na serwer.');
  const station = { id: `r${randomBytes(6).toString('hex')}`, name, genre, url };
  stations.push(station);
  write(guildId, stations);
  return { ...station };
}
function remove(guildId, text) {
  const key=String(text||'').trim().toLowerCase();
  const station = read(guildId).find(s=>s.id===text||s.name.toLowerCase()===key);
  if (!station) throw new Error('Nie znaleziono stacji. Sprawdź /radio list.');
  write(guildId, read(guildId).filter(s => s.id !== station.id));
  return station;
}
function toTrack(station) {
  return { kind: 'radio', source: station.url, title: `📻 ${station.name}`, stationId: station.id, radioRetry: 0, stationName: station.name };
}
module.exports = { MAX_RADIOS, validAudioUrl, normalizeName, normalizeGenre, list, find, add, remove, toTrack, globalList, globalAdd, globalRemove, search };
