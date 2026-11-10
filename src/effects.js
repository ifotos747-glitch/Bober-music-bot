'use strict';
// DJ / EQ presets shared by YouTube, live streams and local music.
// Only prevalidated filter fragments reach FFmpeg (never user-authored ffmpeg arguments).
const fs = require('node:fs');
const path = require('node:path');
const DIR = process.env.BOBER_EFFECTS_DATA_DIR || path.join(__dirname, '..', 'data');
const ID = /^\d{15,24}$/;
const EQ_PRESETS = Object.freeze({
  flat: [0, 0, 0],
  bass: [7, 1, 0],
  vocal: [-3, 4, 2],
  rock: [5, -2, 4],
  electronic: [6, 0, 5],
  soft: [-2, 1, -2],
});
const DJ_MODES = Object.freeze(['off', 'nightcore', 'slowed', 'echo', '8d', 'club']);
const defaults = () => ({ eqPreset: 'flat', bass: 0, mid: 0, treble: 0, dj: 'off' });
function validate(raw) {
  if (!raw || typeof raw !== 'object' || !DJ_MODES.includes(raw.dj)) throw new Error('Nieznany efekt DJ.');
  const values = ['bass', 'mid', 'treble'].map(key => Number(raw[key]));
  if (values.some(v => !Number.isInteger(v) || v < -12 || v > 12)) throw new Error('Pasmo EQ musi mieć od -12 do +12 dB.');
  if (!(raw.eqPreset === 'custom' || Object.hasOwn(EQ_PRESETS, raw.eqPreset))) throw new Error('Nieznany preset equalizera.');
  return { eqPreset: raw.eqPreset, bass: values[0], mid: values[1], treble: values[2], dj: raw.dj };
}
function file(id) {
  if (!ID.test(String(id))) throw new Error('Nieprawidłowy identyfikator serwera.');
  return path.join(DIR, `effects-${id}.json`);
}
function read(id) {
  const name = file(id);
  if (!fs.existsSync(name)) return defaults();
  return validate({ ...defaults(), ...JSON.parse(fs.readFileSync(name, 'utf8')) });
}
function save(id, raw) {
  const setting = validate(raw);
  fs.mkdirSync(DIR, { recursive: true });
  const name = file(id), tmp = `${name}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, ...setting }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, name);
  return setting;
}
function setPreset(current, preset) {
  if (!Object.hasOwn(EQ_PRESETS, preset)) throw new Error('Nieznany preset EQ.');
  const [bass, mid, treble] = EQ_PRESETS[preset];
  return validate({ ...current, eqPreset: preset, bass, mid, treble });
}
function setCustom(current, bass, mid, treble) {
  return validate({ ...current, eqPreset: 'custom', bass, mid, treble });
}
function setDJ(current, dj) { return validate({ ...current, dj }); }
function makeFilters(settings) {
  const { bass, mid, treble, dj } = validate(settings);
  const filters = [];
  // Bass & treble are broad shelves; the midrange is a peaking band.
  if (bass !== 0) filters.push(`bass=g=${bass}:f=120`);
  if (mid !== 0) filters.push(`equalizer=f=1000:t=q:w=1:g=${mid}`);
  if (treble !== 0) filters.push(`treble=g=${treble}:f=6000`);
  if (dj === 'nightcore') filters.push('asetrate=48000*1.15', 'aresample=48000');
  if (dj === 'slowed') filters.push('atempo=0.85');
  if (dj === 'echo') filters.push('aecho=0.75:0.7:140:0.25');
  if (dj === '8d') filters.push('apulsator=hz=0.12');
  if (dj === 'club') filters.push('bass=g=5:f=120', 'treble=g=2:f=6000', 'acompressor=threshold=-18dB:ratio=2.5:attack=10:release=80');
  // Headroom when boosting any band to reduce clipping; output is also limited.
  if (filters.length) filters.push('alimiter=limit=0.95');
  return filters;
}
module.exports = { EQ_PRESETS, DJ_MODES, defaults, validate, read, save, setPreset, setCustom, setDJ, makeFilters };
