const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { buildCorpus } = require('../scripts/export-narration.cjs');

const directory = path.resolve(__dirname, '../assets/narration');
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(directory, 'manifest.js'), 'utf8'), sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.TRIO_NARRATION_MANIFEST)), manifest, 'JSON and browser manifests differ');
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.locale, 'pt-BR');
assert.equal(manifest.provider, 'ElevenLabs');
assert.equal(manifest.modelID, 'eleven_v4');
assert.equal(manifest.voiceID, 'cgSgspJ2msm6clMCkdW9');
assert.match(manifest.configurationSHA256, /^[a-f0-9]{64}$/);
const source = buildCorpus();
const fields = clips => clips.map(({ id, text, file }) => ({ id, text, file }));
assert.deepEqual(fields(manifest.clips), fields(source.clips), 'Audio bundle does not cover the current source corpus exactly');
let bytes = 0, seconds = 0;
for (const clip of manifest.clips) {
  assert.match(clip.file, /^n-[a-f0-9]{24}\.mp3$/);
  const data = fs.readFileSync(path.join(directory, clip.file));
  assert.ok(data.length > 512, `${clip.id}: empty or truncated audio`);
  assert.ok(data.subarray(0, 3).toString() === 'ID3' || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0), `${clip.id}: missing MP3 header`);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'), clip.sha256, `${clip.id}: audio changed after generation`);
  assert.ok(Number.isFinite(clip.durationSeconds) && clip.durationSeconds > 0.05 && clip.durationSeconds < 600, `${clip.id}: invalid duration`);
  bytes += data.length;
  seconds += clip.durationSeconds;
}
assert.deepEqual(fs.readdirSync(directory).filter(file => file.endsWith('.mp3')).sort(), manifest.clips.map(clip => clip.file).sort(), 'Unexpected or missing MP3');
console.log(`PASS narration assets: ${manifest.clips.length} MP3s, ${seconds.toFixed(2)} seconds, ${bytes} bytes; exact corpus and hashes`);
