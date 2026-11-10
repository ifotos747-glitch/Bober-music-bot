'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveTrack } = require('../src/media');
test('wyszukiwanie przekazuje dane do yt-dlp bez powłoki i odczytuje wynik', { skip: process.platform === 'win32' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bober-yt-'));
  const file = path.join(dir, 'fake-yt-dlp');
  fs.writeFileSync(file, '#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({title:"Przykładowy utwór",webpage_url:"https://www.youtube.com/watch?v=abcdefghi12"}))\n');
  fs.chmodSync(file, 0o755);
  process.env.YTDLP_PATH = file;
  try {
    const result = await resolveTrack('przykładowy utwór');
    assert.equal(result.kind, 'youtube');
    assert.equal(result.title, 'Przykładowy utwór');
    assert.equal(result.source, 'https://www.youtube.com/watch?v=abcdefghi12');
  } finally {
    delete process.env.YTDLP_PATH;
    fs.rmSync(dir, { force: true, recursive: true });
  }
});
