'use strict';
// Local host preflight. No tokens or private paths are printed.
require('dotenv').config({quiet:true});
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { getYtdlpPath } = require('../src/media');
const root = path.resolve(__dirname,'..');
let failed = false;
function report(ok, name, required=true) {
  console.log((ok ? 'OK' : 'BRAK') + ' | ' + name);
  if (!ok && required) failed=true;
}
function probe(cmd,args) {
  if (!cmd) return false;
  const result=spawnSync(cmd,args,{timeout:10000,stdio:'ignore',windowsHide:true});
  return result.status===0 && !result.error;
}
const [major,minor]=process.versions.node.split('.').map(Number);
report(major>24 || (major===24 && minor>=17),'Node.js >=24.17');
console.log('Platforma: '+process.platform+'/'+process.arch);
for (const key of ['DISCORD_TOKEN','CLIENT_ID','GUILD_ID']) {
  const value=(process.env[key]||'').trim();
  report(Boolean(value)&&!/_TUTAJ$/.test(value),key,key!=='GUILD_ID');
}
let ff=process.env.FFMPEG_PATH;
if (!ff) { try { ff=require('ffmpeg-static'); } catch {} }
report(probe(ff,['-version']) || probe('ffmpeg',['-version']),'FFmpeg');
report(probe(getYtdlpPath(),['--version']),'yt-dlp',false);
for (const folder of ['data','music']) {
  try { const dest=path.join(root,folder); fs.mkdirSync(dest,{recursive:true}); fs.accessSync(dest,fs.constants.W_OK); report(true,folder+' writable'); }
  catch { report(false,folder+' writable'); }
}
console.log('RAM procesu: '+Math.round(process.memoryUsage().rss/1048576)+' MiB (bez odtwarzania).');
console.log('Discord Voice UDP, radio i YouTube wymagaja testu po uruchomieniu.');
process.exitCode=failed?1:0;
