'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { probeTool } = require('../src/media');

test('diagnostyka wykrywa brak binarki i rozpoznaje dostępny FFmpeg', async () => {
  const missing = await probeTool('/przykladowa/nieistniejaca/sciezka/ffmpeg', ['-version']);
  assert.equal(missing.ok, false);
  const available = await probeTool('ffmpeg', ['-version']);
  if (!available.ok) return; // na hostingu bez FFmpeg diagnostyka ma wykryć problem, nie wywracać testów
  assert.match(available.message, /^ffmpeg version/);
});

test('pipeline FFmpeg emituje niezerową liczbę bajtów dźwięku PCM z demo.wav', async () => {
  if (!(await probeTool('ffmpeg')).ok) return;
  const input = join(__dirname, '../music/demo.wav');
  const ff = spawn('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', input, '-vn', '-map', '0:a:0', '-ac', '2', '-ar', '48000', '-f', 's16le', 'pipe:1']);
  let total = 0, stderr = '';
  ff.stdout.on('data', c => { total += c.length; });
  ff.stderr.on('data', c => { stderr += c; });
  const code = await new Promise((resolve, reject) => { ff.on('error', reject); ff.on('close', resolve); });
  assert.equal(code, 0, stderr);
  assert.ok(total > 10_000, `FFmpeg zwrócił tylko ${total} bajtów audio`);
});
