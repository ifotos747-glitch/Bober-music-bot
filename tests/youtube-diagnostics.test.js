'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { summarize, diagnose } = require('../src/youtube-diagnostics');
const { youtubeArgs } = require('../src/media');
test('klasyfikacja blokady, 403 i sukcesu testu audio', () => {
  assert.equal(summarize('Sign in to confirm you are not a bot', 1, 0, false).type, 'login');
  assert.equal(summarize('HTTP Error 403: Forbidden', 1, 0, false).type, '403');
  assert.equal(summarize('', 0, 1024, false).type, 'ok');
  assert.equal(summarize('', 0, 0, false).type, 'empty');
  assert.equal(summarize('', 1, 0, true).type, 'timeout');
});
test('flaga IPv4 jest opcjonalna i nie zmienia ustawień OAuth', () => {
  const previous = process.env.YOUTUBE_FORCE_IPV4;
  try {
    process.env.YOUTUBE_FORCE_IPV4 = '1';
    assert.ok(youtubeArgs('').includes('--force-ipv4'));
    delete process.env.YOUTUBE_FORCE_IPV4;
    assert.ok(!youtubeArgs('').includes('--force-ipv4'));
  } finally {
    if (previous === undefined) delete process.env.YOUTUBE_FORCE_IPV4;
    else process.env.YOUTUBE_FORCE_IPV4 = previous;
  }
});
test('diagnoza odrzuca inne domeny bez uruchamiania yt-dlp', async () => {
  await assert.rejects(diagnose('https://example.com/other.mp3', {spawnImpl(){throw Error('nie powinno wywołać');}}), /YouTube/);
});
test('diagnoza nie publikuje błędnego URL i rozpoznaje odpowiedź hostingu', async () => {
  let args;
  const mockedSpawn = (_binary, argv) => {
    args = argv;
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    queueMicrotask(() => {
      child.stderr.write('ERROR: Sign in to confirm you are not a bot. link=https://private.example/secret');
      child.stderr.end();
      child.stdout.end();
      child.emit('close', 1);
    });
    return child;
  };
  const result = await diagnose('https://www.youtube.com/watch?v=o54P8p-2LDk', {spawnImpl:mockedSpawn,timeoutMs:1000});
  assert.equal(result.type, 'login');
  assert.ok(!JSON.stringify(result).includes('private.example'));
  assert.ok(args.includes('--test'));
  assert.ok(args.includes('--no-simulate'));
  assert.ok(args.includes('--retries'));
  assert.ok(!args.includes('--cookies'));
});
