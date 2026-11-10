'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { classifySource, restoreSaved, listFiles } = require('../src/media');
test('obsługuje lokalne demo.wav', () => {
  const f = classifySource('demo.wav');
  assert.equal(f.kind, 'file');
  assert.ok(listFiles().includes('demo.wav'));
});
test('rozpoznaje YouTube', () => {
  assert.equal(classifySource('https://www.youtube.com/watch?v=abcdefghi12').kind, 'youtube');
  assert.equal(classifySource('https://youtu.be/abcdefghi12').kind, 'youtube');
});
test('rozpoznaje Spotify track bez odtwarzania bezpośredniego', () => {
  assert.equal(classifySource('https://open.spotify.com/track/1234567890ABC').kind, 'spotify');
  assert.throws(() => classifySource('https://open.spotify.com/playlist/test'));
});
test('wspiera zapytania o tytuł i publiczne URL radia', () => {
  assert.equal(classifySource('moja piosenka').kind, 'query');
  assert.equal(classifySource('https://radio.example.com/listen.mp3').kind, 'radio');
});
test('blokuje pliki poza folderem i prywatne URL', () => {
  for (const value of ['../secrets.txt', '/etc/passwd', 'https://localhost:8090/a', 'http://127.0.0.1/a', 'http://192.168.1.5/a']) {
    assert.throws(() => classifySource(value), value);
  }
});
test('wczytuje zapisane źródła z walidacją', () => {
  assert.equal(restoreSaved({ kind: 'file', source: 'demo.wav', title: 'demo' }).kind, 'file');
  assert.throws(() => restoreSaved({ kind: 'youtube', source: 'http://192.168.0.1/secret' }));
});
