const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runtimeFiles, packagePages } = require('../scripts/package-pages.cjs');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'trio-pages-package-'));
const source = path.join(temporary, 'source');
const output = path.join(temporary, 'site');
function write(file, content = `content of ${file}`) {
  const target = path.join(source, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
try {
  for (const file of runtimeFiles) write(file);
  for (const file of [
    'assets/trio-do-saber.png', 'assets/bioma-pantanal.png',
    'assets/narration/clip-0123_abcd.mp3',
  ]) write(file);
  for (const file of [
    'README.md', 'scripts/generate-narration.py', 'tests/test.cjs',
    '.env', '.git/config', 'assets/narration-script.json',
    'assets/secret.txt', 'assets/narration/temporary.json',
    'assets/narration/failed.mp3.part', 'assets/narration/key.env',
    'data/Biomas_5000mil.zip', 'data/biomes-ibge.geojson',
    'numberblocks-1-100/Claude outputs/draft.html',
    'fono-do-leo/old-game.js', 'DinoFala/Resources/narration.mp3',
  ]) write(file);

  const files = packagePages(source, output);
  assert.equal(files.length, runtimeFiles.length + 3);
  assert.ok(files.includes('.nojekyll'));
  assert.ok(files.includes('CNAME'));
  assert.ok(files.includes('fono-do-leo/index.html'));
  assert.ok(files.includes('fono-do-leo/sw.js'));
  assert.ok(files.includes('assets/narration/manifest.json'));
  assert.ok(files.includes('assets/narration/manifest.js'));
  assert.ok(files.includes('assets/narration/clip-0123_abcd.mp3'));
  for (const file of files) {
    assert.equal(fs.readFileSync(path.join(output, file), 'utf8'), fs.readFileSync(path.join(source, file), 'utf8'));
  }
  assert.equal(fs.existsSync(path.join(output, 'README.md')), false);
  assert.equal(fs.existsSync(path.join(output, 'assets/narration-script.json')), false);
  assert.equal(fs.existsSync(path.join(output, 'DinoFala')), false);
  assert.throws(() => packagePages(source, output), /empty or absent/);
  assert.throws(() => packagePages(source, source), /must not contain/);
  assert.throws(() => packagePages(source, temporary), /must not contain/);

  fs.unlinkSync(path.join(source, 'assets/narration/manifest.json'));
  const incomplete = path.join(temporary, 'incomplete');
  assert.throws(() => packagePages(source, incomplete), /ENOENT/);
  assert.equal(fs.existsSync(incomplete), false, 'missing runtime files must fail before creating an artifact');
  console.log(`PASS Pages packaging: ${files.length} runtime files, preserved paths, no source/credentials/drafts, required files enforced`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
