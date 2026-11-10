'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bober-fx-'));
process.env.BOBER_EFFECTS_DATA_DIR = dir;
const fx = require('../src/effects');
const id = '123456789012345678';
test('domyślne ustawienia i bezpieczne wartości', () => {
  assert.deepEqual(fx.read(id), fx.defaults());
  assert.deepEqual(fx.makeFilters(fx.defaults()), []);
  assert.throws(() => fx.setCustom(fx.defaults(), 99, 0, 0), /EQ/);
  assert.throws(() => fx.setDJ(fx.defaults(), ';rm -rf'), /DJ/);
});
test('presety EQ działają i zapamiętują się', () => {
  const setting = fx.setPreset(fx.defaults(), 'rock');
  assert.deepEqual([setting.bass, setting.mid, setting.treble], [5, -2, 4]);
  fx.save(id, setting);
  assert.deepEqual(fx.read(id), setting);
  assert.match(fx.makeFilters(setting).join(','), /equalizer=f=1000/);
});
test('DJ wpływa na FFmpeg i nie ingeruje w źródło', () => {
  for (const dj of fx.DJ_MODES) {
    const setting = fx.setDJ(fx.defaults(), dj);
    const filters = fx.makeFilters(setting);
    assert.equal(filters.length > 0, dj !== 'off');
  }
  assert.match(fx.makeFilters(fx.setDJ(fx.defaults(), 'nightcore')).join(','), /asetrate/);
  assert.match(fx.makeFilters(fx.setDJ(fx.defaults(), '8d')).join(','), /apulsator/);
});
test.after(() => fs.rmSync(dir, { recursive:true, force:true }));
