'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bober-radios-'));
process.env.BOBER_RADIO_DATA_DIR = dir;
const radios = require('../src/radios');
const guild = '123456789012345678';
test('brak stacji na nowym serwerze', () => assert.deepEqual(radios.list(guild), []));
test('dodawanie stacji i zapis na dysk', () => {
  const r = radios.add(guild, 'NOVA RADIO', 'https://example.com/audio.mp3', 'Pop');
  assert.ok(/^r[a-f0-9]{12}$/.test(r.id));
  assert.equal(radios.list(guild)[0].name, 'NOVA RADIO');
  assert.equal(radios.find(guild, 'nova radio').id, r.id);
  assert.equal(radios.toTrack(r).kind, 'radio');
  assert.ok(fs.existsSync(path.join(dir, `radios-${guild}.json`)));
});
test('odrzucenie duplikatu nazwy', () => assert.throws(() => radios.add(guild, 'nova radio', 'https://example.com/stream'), /już istnieje/));
test('odrzucenie linków Spotify i YouTube', () => {
  assert.throws(() => radios.validAudioUrl('https://www.youtube.com/watch?v=aaaaaaaaaaa'), /nie link/);
  assert.throws(() => radios.validAudioUrl('https://open.spotify.com/track/abcd1234'), /nie link/);
});
test('odrzucenie adresu lokalnego', () => assert.throws(() => radios.validAudioUrl('http://127.0.0.1:8080/stream'), /publiczny/));
test('usuwanie stacji', () => {
  const old = radios.remove(guild, 'NOVA RADIO');
  assert.equal(old.name, 'NOVA RADIO');
  assert.equal(radios.list(guild).length, 0);
});
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
