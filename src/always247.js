'use strict';
const fs = require('node:fs');
const path = require('node:path');
const DIR = process.env.BOBER_247_DATA_DIR || path.join(__dirname, '..', 'data');
const ID = /^\d{15,24}$/;
function file(guildId) {
  if (!ID.test(String(guildId))) throw new Error('Nieprawidłowy identyfikator serwera.');
  return path.join(DIR, `247-${guildId}.json`);
}
function validate(data) {
  if (!data || !['radio', 'autodj', 'silent'].includes(data.mode) || !ID.test(String(data.channelId)) ||
      !ID.test(String(data.textChannelId)) || (data.mode === 'radio' && !/^r[a-f0-9]{12}$/.test(String(data.stationId)))) {
    throw new Error('Błędna konfiguracja trybu 24/7.');
  }
  return { mode: data.mode, channelId: String(data.channelId), textChannelId: String(data.textChannelId),
    stationId: data.mode === 'radio' ? String(data.stationId) : null };
}
function read(guildId) {
  const name = file(guildId);
  if (!fs.existsSync(name)) return null;
  return validate(JSON.parse(fs.readFileSync(name, 'utf8')));
}
function save(guildId, data) {
  const config = validate(data);
  fs.mkdirSync(DIR, { recursive: true });
  const name = file(guildId), tmp = `${name}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, ...config }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, name);
  return config;
}
function remove(guildId) { try { fs.unlinkSync(file(guildId)); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
function list() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter(n => /^247-\d{15,24}\.json$/.test(n)).map(n => {
    const guildId = n.slice(4, -5);
    try { return { guildId, ...read(guildId) }; }
    catch (e) { console.warn('[24/7] Uszkodzony zapis dla serwera:', guildId, e.message); return null; }
  }).filter(Boolean);
}
module.exports = { read, save, remove, list, validate };
