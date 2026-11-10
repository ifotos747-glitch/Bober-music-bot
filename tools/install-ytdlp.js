'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const ROOT = path.resolve(__dirname, '..');
// Oficjalny yt-dlp 2026.10.26, SHA-256 opublikowane w GitHub Releases.
const RELEASE = '2026.10.26';
const ASSETS = {
  'linux-x64': { file: 'yt-dlp_linux', hash: '767ba9dce7052aa196f8b12652f433d76de128ba168966fa84b6394d5e6c6795' },
  'win32-x64': { file: 'yt-dlp.exe', hash: 'f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d' },
};
async function ensureYtdlp() {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
  const asset = ASSETS[`${process.platform}-${process.arch}`];
  if (!asset) throw new Error(`Automatyczny instalator nie obsługuje ${process.platform}/${process.arch}. Ustaw YTDLP_PATH.`);
  const dest = path.join(ROOT, 'tools', asset.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1_000_000) {
    if (process.platform !== 'win32') await fsp.chmod(dest, 0o755);
    return dest;
  }
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const url = `https://github.com/yt-dlp/yt-dlp/releases/download/${RELEASE}/${asset.file}`;
  console.log(`⬇️ Pobieranie oficjalnego yt-dlp ${RELEASE} (może zająć chwilę) ...`);
  const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!res.ok || !res.body) throw new Error(`GitHub zwrócił HTTP ${res.status}. Hosting mógł zablokować pobieranie.`);
  const tmp = dest + '.part';
  const sha = createHash('sha256');
  let total = 0;
  const validate = new Transform({
    transform(chunk, _, cb) {
      total += chunk.length;
      if (total > 55 * 1024 * 1024) return cb(new Error('Plik yt-dlp przekroczył limit 55 MB.'));
      sha.update(chunk);
      cb(null, chunk);
    }
  });
  try {
    await pipeline(Readable.fromWeb(res.body), validate, fs.createWriteStream(tmp, { mode: 0o755 }));
    if (sha.digest('hex') !== asset.hash) throw new Error('Suma SHA-256 yt-dlp nie pasuje — instalacja odrzucona.');
    await fsp.rename(tmp, dest);
    if (process.platform !== 'win32') await fsp.chmod(dest, 0o755);
  } catch (e) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
  return dest;
}
if (require.main === module) ensureYtdlp()
  .then(path => console.log('✅ yt-dlp zainstalowane:', path))
  .catch(e => { console.error('❌ yt-dlp:', e.message); process.exitCode = 1; });
module.exports = { ensureYtdlp };
