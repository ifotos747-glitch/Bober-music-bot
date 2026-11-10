
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {resolveTrack,youtubeArgs,isYoutubeChallenge,restoreSaved} = require('../src/media');
test('YouTube CLI args include EJS; optionally select client', () => {
  assert.ok(youtubeArgs().includes('ejs:github'));
  const a = youtubeArgs('web_safari,web_embedded');
  assert.ok(a.includes('youtube:player_client=web_safari,web_embedded'));
  assert.throws(()=>youtubeArgs('bad; cmd'),/Niepoprawne/);
});
test('Detector responds only to challenge-like errors',()=>{
  assert.equal(isYoutubeChallenge('Sign in to confirm you’re not a bot.'),true);
  assert.equal(isYoutubeChallenge('HTTP Error 429'),true);
  assert.equal(isYoutubeChallenge('File not found'),false);
});
test('Falls back to alternate client when default session is challenged', {skip:process.platform==='win32'}, async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bober-yt-fallback-'));
  const fake=path.join(dir,'fake-yt');
  fs.writeFileSync(fake, `#!/usr/bin/env node
const args=process.argv.slice(2);
if (!args.some(x=>x.includes('web_safari'))) { console.error('Sign in to confirm you are not a bot.'); process.exit(1); }
process.stdout.write(JSON.stringify({title:'ok',webpage_url:'https://youtu.be/abcdefghijk'}));
`);
  fs.chmodSync(fake,0o755);
  process.env.YTDLP_PATH=fake;
  process.env.YOUTUBE_FETCH_METADATA='1';
  try {
    const item=await resolveTrack('https://youtu.be/abcdefghijk');
    assert.equal(item.youtubeClient,'web_safari,web_embedded');
    assert.equal(restoreSaved(item).youtubeClient,item.youtubeClient);
  } finally { delete process.env.YTDLP_PATH; delete process.env.YOUTUBE_FETCH_METADATA; fs.rmSync(dir,{recursive:true,force:true}); }
});
