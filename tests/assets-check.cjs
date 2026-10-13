const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const { execFileSync } = require('node:child_process');

for (const file of ['app.js', 'game-data.js', 'world-data.js', 'country-content.js', 'biome-geometry.js', 'numberblocks-somar/numberblocks.js', 'numberblocks-1-100/game-voice.js']) {
  new vm.Script(read(file), { filename: file });
}
for (const file of ['index.html', 'numberblocks-somar/index.html', 'numberblocks-1-100/blocos-de-somar.html', 'fono-do-leo/index.html']) {
  const html = read(file);
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc=/.test(match[1])) new vm.Script(match[2], { filename: file });
  }
  for (const [, link] of html.matchAll(/\b(?:src|href)="([^"#]+)"/g)) {
    if (!/^(https?:|data:|blob:)|\$\{/.test(link)) {
      assert.ok(fs.existsSync(path.resolve(root, path.dirname(file), link)), `${file}: missing ${link}`);
    }
  }
}
for (let number = 1; number <= 100; number++) {
  const file = `numberblocks-1-100/${String(number).padStart(3, '0')}.webp`;
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', file);
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', file);
}
// Fono do Leo runs as ES modules without a build step: check syntax and that every import resolves.
const fonoModules = [];
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).forEach(entry => {
  const rel = path.join(dir, entry.name);
  if (entry.isDirectory()) walk(rel);
  else if (rel.endsWith('.js')) fonoModules.push(rel);
});
walk('fono-do-leo/js');
for (const file of fonoModules) {
  const code = read(file);
  try {
    execFileSync(process.execPath, ['--input-type=module', '--check'], { input: code, stdio: 'pipe' });
  } catch (error) {
    assert.fail(`${file}: ${error.stderr}`);
  }
  for (const [, spec] of code.matchAll(/(?:from|import\()\s*'(\.{1,2}\/[^']+)'/g)) {
    assert.ok(fs.existsSync(path.resolve(root, path.dirname(file), spec)), `${file}: missing import ${spec}`);
  }
}
new vm.Script(read('fono-do-leo/sw.js'), { filename: 'fono-do-leo/sw.js' });
for (const file of ['fono-do-leo/models/face_landmarker.task', 'fono-do-leo/vendor/mediapipe-0.10.35/wasm/vision_wasm_internal.wasm',
  'fono-do-leo/vendor/mediapipe-0.10.35/wasm/vision_wasm_nosimd_internal.wasm', 'fono-do-leo/manifest.webmanifest']) {
  assert.ok(fs.statSync(path.join(root, file)).size > 0, `missing ${file}`);
}
console.log(`PASS JavaScript syntax, local page assets, all 100 WebP images and ${fonoModules.length} Fono do Leo modules`);
