'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bober-247-'));
process.env.BOBER_247_DATA_DIR = dir;
const store = require('../src/always247');
const guildId = '123456789012345678';
const config = { mode: 'radio', channelId: '223456789012345678', textChannelId: '323456789012345678', stationId: 'r0123456789ab' };
test('zapis radia 24/7 po restarcie', () => {
  assert.equal(store.read(guildId), null);
  store.save(guildId, config);
  assert.deepEqual(store.read(guildId), config);
  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].guildId, guildId);
});
test('przełączenie na AutoDJ i usunięcie', () => {
  store.save(guildId, { mode:'autodj', channelId: config.channelId, textChannelId: config.textChannelId });
  assert.equal(store.read(guildId).mode, 'autodj');
  assert.equal(store.read(guildId).stationId, null);
  assert.equal(store.remove(guildId), true);
  assert.equal(store.read(guildId), null);
});
test('tryb cichego czuwania bez radio i ffmpeg', () => {
  const setting = store.save(guildId, {mode:'silent', channelId: config.channelId, textChannelId: config.textChannelId});
  assert.equal(setting.mode,'silent');
  assert.equal(setting.stationId,null);
  assert.equal(store.read(guildId).mode,'silent');
});
test('odrzucanie błędnych wartości', () => {
  assert.throws(() => store.save(guildId, { ...config, channelId:'abc' }), /konfiguracja/);
  assert.throws(() => store.save(guildId, { ...config, mode:'youtube' }), /konfiguracja/);
});
test.after(() => fs.rmSync(dir, { recursive:true, force:true }));
