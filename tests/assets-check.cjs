const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

for (const file of ['app.js', 'game-data.js', 'world-data.js', 'country-content.js', 'biome-geometry.js', 'numberblocks-somar/numberblocks.js', 'numberblocks-1-100/game-voice.js']) {
  new vm.Script(read(file), { filename: file });
}
for (const file of ['index.html', 'numberblocks-somar/index.html', 'numberblocks-1-100/blocos-de-somar.html']) {
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
console.log('PASS JavaScript syntax, local page assets and all 100 WebP images');
