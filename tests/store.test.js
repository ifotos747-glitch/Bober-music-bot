'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const store = require('../src/store');
const id = '999999999999999999';
const file = path.join(__dirname, '..', 'data', id + '.json');
test('zapisz, wczytaj, usuń playlistę', () => {
  try {
    const count = store.save(id, 'Moja muzyka', [{ kind: 'file', source: 'demo.wav', title: 'demo' }]);
    assert.equal(count, 1);
    assert.equal(store.load(id, 'Moja muzyka')[0].source, 'demo.wav');
    assert.equal(store.list(id)[0].name, 'Moja muzyka');
    store.remove(id, 'Moja muzyka');
    assert.equal(store.list(id).length, 0);
  } finally { fs.rmSync(file, { force: true }); }
});
test('nie przyjmuje niebezpiecznych nazw', () => {
  assert.throws(() => store.normalizeName('../etc/passwd'));
  assert.throws(() => store.normalizeName(''));
});
