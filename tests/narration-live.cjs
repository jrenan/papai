/* REAL-BUNDLE integration test; requires the complete generated/verified MP3 set.
 * Start a static server, then: BASE_URL=http://127.0.0.1:8000 node tests/narration-live.cjs
 * No HTML, manifest, audio, play result or speech API is replaced by a fixture.
 * Chromium desktop + WebKit mobile; BROWSER=chromium|webkit selects one engine.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const root = path.resolve(__dirname, '..');
const baseURL = (process.env.BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const siteOrigin = new URL(baseURL).origin;
const readJSON = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

function requireRealBundle() {
  const prerequisite = 'Generate, package and verify the complete REAL narration bundle before running narration-live.cjs; fixtures and partial batches are not accepted.';
  for (const file of ['assets/narration-script.json', 'assets/narration/manifest.json', 'assets/narration/manifest.js']) {
    assert.ok(fs.existsSync(path.join(root, file)), `${prerequisite} Missing: ${file}`);
  }
  const source = readJSON('assets/narration-script.json');
  const manifest = readJSON('assets/narration/manifest.json');
  assert.equal(manifest.provider, 'ElevenLabs', prerequisite);
  assert.equal(manifest.modelID, 'eleven_v4', prerequisite);
  assert.equal(manifest.voiceID, 'cgSgspJ2msm6clMCkdW9', 'The real bundle must use the chosen Jessica voice');
  assert.equal(manifest.locale, 'pt-BR', prerequisite);
  assert.deepEqual(manifest.clips.map(({ id, text, file }) => ({ id, text, file })),
    source.clips.map(({ id, text, file }) => ({ id, text, file })), `${prerequisite} Corpus coverage differs.`);
  const bootstrap = fs.readFileSync(path.join(root, 'assets/narration/manifest.js'), 'utf8').trim();
  const prefix = 'window.TRIO_NARRATION_MANIFEST=';
  assert.ok(bootstrap.startsWith(prefix) && bootstrap.endsWith(';'), 'Invalid real manifest bootstrap');
  assert.deepEqual(JSON.parse(bootstrap.slice(prefix.length, -1)), manifest, 'JSON and gesture-ready JS manifest must agree');
  for (const clip of manifest.clips) {
    assert.match(clip.file, /^[a-zA-Z0-9_-]+\.mp3$/);
    const file = path.join(root, 'assets/narration', clip.file);
    assert.ok(fs.existsSync(file), `${prerequisite} Missing: ${clip.file}`);
    const audio = fs.readFileSync(file);
    assert.equal(crypto.createHash('sha256').update(audio).digest('hex'), clip.sha256, `${clip.file}: real bundle hash mismatch`);
    assert.ok(clip.durationSeconds > 0.05 && clip.durationSeconds < 600, `${clip.file}: missing verified duration`);
  }
  return { source, manifest };
}

// Observe actual media elements while preserving the browser's native play()
// call, promise, decoder, timing, gesture policy and ended events.
function observeNativeAudio() {
  const probe = window.__realNarrationProbe = { calls: [], media: [] };
  const nativePlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    if (!probe.media.includes(this)) probe.media.push(this);
    const source = this.src;
    const call = { source, rate: this.playbackRate, duration: 0, maxTime: 0,
      readyState: 0, resolved: false, ended: false, error: '' };
    probe.calls.push(call);
    const update = () => {
      if (this.src !== source) return;
      call.duration = Number.isFinite(this.duration) ? this.duration : 0;
      call.maxTime = Math.max(call.maxTime, this.currentTime || 0);
      call.readyState = Math.max(call.readyState, this.readyState);
    };
    for (const event of ['loadedmetadata', 'playing', 'timeupdate']) this.addEventListener(event, update);
    this.addEventListener('ended', () => { call.ended = true; update(); }, { once: true });
    const attempt = nativePlay.apply(this, args);
    if (attempt?.then) attempt.then(() => { call.resolved = true; update(); }, error => { call.error = error.name; });
    return attempt;
  };
}

function audioFile(url) {
  return decodeURIComponent(new URL(url).pathname.split('/').pop());
}

async function createPage(browser, mobile) {
  const page = await browser.newPage({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);
  const issues = { errors: [], localFailures: [], speechAPI: [] };
  page.on('pageerror', error => issues.errors.push(error.message));
  page.on('response', response => {
    if (new URL(response.url()).origin === siteOrigin && response.status() >= 400) {
      issues.localFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('request', request => {
    const url = new URL(request.url());
    if (/(^|\.)elevenlabs\.io$/i.test(url.hostname)) issues.speechAPI.push(request.url());
  });
  // External font failures should not decide local narration correctness.
  // No game HTML, manifest, recording or media API is intercepted.
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.addInitScript(observeNativeAudio);
  return { page, issues };
}

async function ready(page, manifest) {
  await page.waitForFunction(() => window.TrioNarration?.getState().ready);
  assert.equal(await page.evaluate(() => TRIO_NARRATION_MANIFEST.configurationSHA256), manifest.configurationSHA256,
    'Server must serve the same complete bundle as the verified local manifest');
  assert.equal(await page.evaluate(() => TRIO_NARRATION_MANIFEST.clips.length), manifest.clips.length);
}

async function mark(page) {
  return page.evaluate(() => __realNarrationProbe.calls.length);
}

async function waitForRealDecode(page, start, file, expectedRate = 1) {
  await page.waitForFunction(({ start, file }) => __realNarrationProbe.calls.slice(start).some(call =>
    call.source.includes('/' + file) && call.resolved && call.duration > 0 && call.maxTime > 0.03 && call.readyState >= 2),
  { start, file }, { timeout: 30000 });
  const call = await page.evaluate(({ start, file }) => __realNarrationProbe.calls.slice(start).find(call =>
    call.source.includes('/' + file) && call.resolved && call.duration > 0 && call.maxTime > 0.03), { start, file });
  assert.equal(call.rate, expectedRate, `${file}: actual media playbackRate`);
  assert.equal(call.error, '', `${file}: browser rejected real playback`);
}

async function assertStopped(page) {
  await page.waitForFunction(() => TrioNarration.getState().status === 'ready' &&
    __realNarrationProbe.media.every(media => media.paused && !media.getAttribute('src')));
  const count = await mark(page);
  // Catch stale sequence continuation after the navigation/stop handlers.
  await page.waitForTimeout(250);
  assert.equal(await mark(page), count, 'Cancelled narration must not start its next recording');
}

function assertNoRuntimeFailures(issues) {
  assert.deepEqual(issues.errors, [], 'Unexpected browser script errors');
  assert.deepEqual(issues.localFailures, [], 'Local runtime resources returned HTTP errors');
  assert.deepEqual(issues.speechAPI, [], 'Runtime must play local MP3 without contacting ElevenLabs');
}

async function verifyBiomesAndWorld(browser, mobile, bundle) {
  const { page, issues } = await createPage(browser, mobile);
  try {
    await page.goto(baseURL);
    await ready(page, bundle.manifest);
    assert.equal(await page.evaluate(() => __realNarrationProbe.calls.filter(call => /\.mp3(?:\?|$)/.test(call.source)).length), 0,
      'No narration may play eagerly before a user gesture');
    await page.locator('[data-open-game="biomes"]').click();
    await page.locator('#startButton').click();
    const expectedPrompt = bundle.source.clips.find(clip => clip.sources.includes('biomes:tuiuiu:prompt'));
    assert.ok(expectedPrompt, 'First biome prompt must be in the complete corpus');
    let start = await mark(page);
    await page.locator('#voiceButton').click();
    await waitForRealDecode(page, start, expectedPrompt.file);
    await page.locator('#mission [data-back-hub]').click();
    await assertStopped(page);

    await page.locator('[data-open-game="world"]').click();
    await page.waitForFunction(() => document.querySelectorAll('#countryStrip [data-country]').length > 100);
    await page.locator('#toggleCountryBrowser').click();
    await page.locator('#countrySearch').fill('Brasil');
    await page.locator('#countryStrip [data-country]').click();
    assert.equal(await page.locator('#countryName').textContent(), 'Brasil');
    const text = await page.evaluate(() => `${document.querySelector('#countryName').textContent}. ${document.querySelector('#countryMusic').textContent}`);
    const ids = await page.evaluate(text => TrioNarration.resolve(text), text);
    assert.equal(ids.length, 2, 'Brazil narration must compose the country name and its music text');
    const expectedFiles = ids.map(id => bundle.manifest.clips.find(clip => clip.id === id).file);
    start = await mark(page);
    await page.locator('#musicButton').click();
    await waitForRealDecode(page, start, expectedFiles[0]);
    await waitForRealDecode(page, start, expectedFiles[1]);
    await page.waitForFunction(() => TrioNarration.getState().status === 'ready', null, { timeout: 45000 });
    const calls = await page.evaluate(start => __realNarrationProbe.calls.slice(start).filter(call => /\.mp3(?:\?|$)/.test(call.source)), start);
    assert.deepEqual(calls.map(call => audioFile(call.source)), expectedFiles, 'Real MP3 playback must follow name → music order');
    assert.ok(calls.every(call => call.ended), 'Both Brazil clips must finish using real decoder ended events');
    start = await mark(page);
    await page.locator('#musicButton').click();
    await waitForRealDecode(page, start, expectedFiles[0]);
    await page.locator('#closeCountryPanel').click();
    await assertStopped(page);
    assertNoRuntimeFailures(issues);
  } finally {
    await page.close();
  }
}

const arithmetic = [
  { url: 'numberblocks-1-100/blocos-de-somar.html',
    intro: 'Vamos brincar de somar? Arraste os blocos com calma. Você pode ouvir de novo quando quiser.',
    firstFragment: 'Monte o número' },
  { url: 'numberblocks-somar/index.html',
    intro: 'Vamos juntar os amigos e contar os blocos? Você pode ouvir de novo quando quiser.',
    firstFragment: 'Vamos montar o' },
];

async function verifyArithmetic(browser, mobile, bundle, game) {
  const { page, issues } = await createPage(browser, mobile);
  try {
    await page.goto(`${baseURL}/${game.url}`);
    await ready(page, bundle.manifest);
    assert.equal(await page.locator('#voice-choice').isDisabled(), true);
    assert.match(await page.locator('#voice-choice').textContent(), /Jessica/);
    await page.locator('.voice-settings summary').click();
    await page.locator('#voice-speed').selectOption('0.82');
    const intro = bundle.manifest.clips.find(clip => clip.text === game.intro);
    assert.ok(intro, `${game.url}: reviewed real intro must exist`);
    let start = await mark(page);
    await page.locator('[data-act="voice-test"]').click();
    await waitForRealDecode(page, start, intro.file, 0.82);
    await page.locator('[data-act="sound"]').click();
    await assertStopped(page);
    assert.equal(await page.locator('[data-act="sound"]').getAttribute('aria-pressed'), 'false');

    start = await mark(page);
    await page.locator('[data-act="level"]').first().click();
    await page.locator('[data-act="repeat"]').click();
    assert.equal(await page.evaluate(start => __realNarrationProbe.calls.slice(start).filter(call => /\.mp3(?:\?|$)/.test(call.source)).length, start), 0,
      'Muted level entry and repeat must not start narration');
    await page.locator('[data-act="sound"]').click();
    start = await mark(page);
    await page.locator('[data-act="repeat"]').click();
    const firstFragment = bundle.manifest.clips.find(clip => clip.text === game.firstFragment);
    assert.ok(firstFragment, 'Arithmetic instruction must resolve from the real composition vocabulary');
    await waitForRealDecode(page, start, firstFragment.file, 0.82);
    await page.locator('[data-act="home"]').click();
    await assertStopped(page);
    await page.locator('.voice-settings summary').click();
    assert.equal(await page.locator('#voice-speed').inputValue(), '0.82');
    await page.reload();
    await ready(page, bundle.manifest);
    assert.equal(await page.locator('#voice-speed').inputValue(), '0.82', 'Narration speed survives reload');
    assert.equal(await page.evaluate(() => __realNarrationProbe.calls.filter(call => /\.mp3(?:\?|$)/.test(call.source)).length), 0,
      'Reload must not automatically resume a recording');
    assertNoRuntimeFailures(issues);
  } finally {
    await page.close();
  }
}

async function verify(engine, name, mobile, bundle) {
  const browser = await engine.launch({ headless: true });
  try {
    await verifyBiomesAndWorld(browser, mobile, bundle);
    console.log(`PASS ${name}: real Biomas prompt, Brazil name → music decode/end, navigation cancellation`);
    for (const game of arithmetic) {
      await verifyArithmetic(browser, mobile, bundle, game);
      console.log(`PASS ${name}: ${game.url}, real intro/composition, speed, mute and navigation cancellation`);
    }
  } finally {
    await browser.close();
  }
}

(async () => {
  const bundle = requireRealBundle();
  if (!process.env.BROWSER || process.env.BROWSER === 'chromium') await verify(chromium, 'Chromium', false, bundle);
  if (!process.env.BROWSER || process.env.BROWSER === 'webkit') await verify(webkit, 'WebKit mobile', true, bundle);
})().catch(error => { console.error(error); process.exitCode = 1; });
