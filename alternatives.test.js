'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bober-alt-'));
process.env.BOBER_ALTERNATIVES_DATA_DIR = dir;
const alternatives = require('../src/alternatives');
const { resolveTrack, classifyYoutubeFailure, findLocalSpotifyTrack } = require('../src/media');
const guild = '123456789012345678';
test('zapis linków Spotify jest niezależny od query ?si', () => {
  const original = 'https://open.spotify.com/track/7MkbOrtTIUzlcek3uE0th9?si=abcdef';
  alternatives.add(guild, original, 'demo.wav');
  const result = alternatives.find(guild, 'https://open.spotify.com/track/7MkbOrtTIUzlcek3uE0th9');
  assert.equal(result.kind, 'file');
  assert.equal(result.source, 'demo.wav');
});
test('mapowanie YouTube normalizuje youtu.be i youtube.com', async () => {
  alternatives.add(guild, 'https://youtu.be/jNQXAC9IVRw', 'demo.wav');
  const resolved = await resolveTrack('https://www.youtube.com/watch?v=jNQXAC9IVRw', { guildId: guild });
  assert.equal(resolved.kind, 'file');
});
test('lokalne dopasowanie nie wybiera przypadkowej muzyki', () => {
  assert.equal(findLocalSpotifyTrack('Nieznana piosenka', 'X'), null);
});
test('adresy prywatne i źródła YouTube nie są dozwolonym audio zastępczym', () => {
  assert.throws(() => alternatives.add(guild, 'Przykład', 'http://127.0.0.1:8080/sekret'));
  assert.throws(() => alternatives.add(guild, 'Przykład', 'https://youtu.be/jNQXAC9IVRw'));
});
test('admin może usunąć przypisanie', () => {
  alternatives.add(guild, 'Test123', 'demo.wav');
  assert.ok(alternatives.find(guild,'Test123'));
  alternatives.remove(guild, 'Test123');
  assert.equal(alternatives.find(guild,'Test123'), null);
});
test('403 i błędy logowania YouTube są rozróżnione', () => {
  assert.equal(classifyYoutubeFailure('HTTP Error 403: Forbidden').type, '403');
  assert.equal(classifyYoutubeFailure('Sign in to confirm you are not a bot').type, 'login');
  assert.equal(classifyYoutubeFailure('Requested format is not available').type, 'format');
});
test('bezpośredni film YouTube nie pobiera zbędnych metadanych', async () => {
  delete process.env.YOUTUBE_FETCH_METADATA;
  const track = await resolveTrack('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  assert.equal(track.kind, 'youtube');
  assert.match(track.title,/YouTube/);
});
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
