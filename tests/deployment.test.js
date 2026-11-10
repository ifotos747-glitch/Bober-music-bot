const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
test('katalog główny wskazuje komplet plików 4.0', () => {
  const entry = fs.readFileSync(path.join(root,'index.js'), 'utf8');
  assert.match(entry, /START BOBER MUSIC BOT/);
  assert.match(fs.readFileSync(path.join(root,'src/index.js'),'utf8'), /BOBER MUSIC BOT 4.0/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version, '4.0.0');
});
test('testaudio jest zarejestrowane dokładnie raz', () => {
  const source = fs.readFileSync(path.join(root,'src/shared.js'), 'utf8');
  assert.equal((source.match(/setName\('testaudio'\)/g) || []).length,1);
});
test('oryginalny test Ogg Opus jest dostępny i nie jest pusty', () => {
  const bytes = fs.readFileSync(path.join(root,'music/test-dzwiek.ogg'));
  assert.equal(bytes.toString('ascii',0,4),'OggS');
  assert.ok(bytes.length>10_000);
  assert.ok(bytes.includes(Buffer.from('OpusHead')));
});

test('radio jest jedną komendą i ma podkomendy', () => {
  const source = fs.readFileSync(path.join(root,'src/shared.js'), 'utf8');
  assert.equal((source.match(/setName\('radio'\)/g) || []).length,1);
  for (const name of ['list','play','add','remove','panel','now','stop']) assert.ok(source.includes(`setName('${name}')`));
});

test('komenda /247 i trwały magazyn są w aktualizacji', () => {
  const source = fs.readFileSync(path.join(root,'src/shared.js'), 'utf8');
  assert.equal((source.match(/setName\('247'\)/g) || []).length,1);
  assert.match(fs.readFileSync(path.join(root,'src/index.js'), 'utf8'), /ensure247Running/);
  assert.ok(fs.existsSync(path.join(root,'src/always247.js')));
});

test('kolejka nie ponawia natychmiast przy oczekiwaniu na radio', () => {
  const code = fs.readFileSync(path.join(root,'src/player.js'), 'utf8');
  assert.match(code, /!this\.retryTimer &&\s*\(this\.queue\.length > 0 \|\| \(this\.alwaysOn && this\.alwaysOn\.mode !== 'silent'\)\)/);
  assert.match(code, /radio247RetryAt/);
});

test('ciche czuwanie nie tworzy natychmiastowej pętli odtwarzania', () => {
  const code = fs.readFileSync(path.join(root,'src/player.js'), 'utf8');
  assert.match(code, /this\.alwaysOn\?\.mode === 'silent'/);
  assert.match(code, /this\.alwaysOn\.mode !== 'silent'/);
});
test('DJ i equalizer używają wspólnego potoku FFmpeg', () => {
  const code = fs.readFileSync(path.join(root,'src/player.js'), 'utf8');
  assert.match(code, /effectsStore\.makeFilters\(this\.effects\)/);
  assert.match(code, /'-af', filters\.join\(','\)/);
  const commands = fs.readFileSync(path.join(root,'src/shared.js'),'utf8');
  assert.equal((commands.match(/setName\('dj'\)/g)||[]).length,1);
  assert.equal((commands.match(/setName\('equalizer'\)/g)||[]).length,1);
});

test('komenda alternatywa oraz katalog zrodla', () => {
  const source = fs.readFileSync(path.join(root, 'src/shared.js'), 'utf8');
  assert.equal((source.match(/setName\('alternatywa'\)/g) || []).length, 1);
  const entry = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
  assert.match(entry, /src\/alternatives\.js/);
});

test('komendy /zrodla i nowe komendy 4.0', () => {
  const text=fs.readFileSync(path.join(root,'src/shared.js'),'utf8');
  for (const command of ['zrodla','kolejka','powtorz','ulubione']) assert.match(text, new RegExp("setName\\('"+command+"'\\)"));
  assert.match(text,/setName\('szukaj'\)/);
  assert.match(text,/setName\('graj'\)/);
  assert.match(fs.readFileSync(path.join(root,'src/player.js'),'utf8'), /track.kind === 'stream'/);
});

test('4.0: GitHub CI i dokumentacja wdrożenia nie wymagają sekretów', () => {
  const github = fs.readFileSync(path.join(root,'.github/workflows/test.yml'),'utf8');
  const gitignore = fs.readFileSync(path.join(root,'.gitignore'),'utf8');
  assert.match(github,/npm run check/);
  assert.match(gitignore,/(^|\n)\.env\n/);
  assert.match(gitignore,/(^|\n)data\/\n/);
  assert.ok(fs.existsSync(path.join(root,'BH_README.md')));
  assert.ok(fs.existsSync(path.join(root,'GITHUB_INSTRUKCJA.md')));
  assert.ok(!fs.existsSync(path.join(root,'.env')));
});
