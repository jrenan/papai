// Run with a local static server: BASE_URL=http://127.0.0.1:8000 node tests/fono-regression.cjs
// Requires Playwright's Chromium (fake camera and microphone) and WebKit (iPhone layout).
// The fake camera shows no face, so this checks the plumbing: the MediaPipe model loads from the
// vendored files and runs on the stream, the screens open, the parent's +1 completes an exercise,
// and progress and settings are saved. Face and tongue detection are tuned with real recordings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium, webkit } = require('playwright');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const appURL = `${baseURL}/fono-do-leo/index.html?dev`;

// A fresh neutral-face calibration, so exercises open without the magic mirror.
const BASELINE = {
  mouthW: 0.55, openIn: 0.01, upperLip: 0.09, lowerLip: 0.1, cheekW: 1.5, cheekAsym: 0, bs: {},
  tz: { outUp: 0, outDown: 0, outLeft: 0, outRight: 0, insideRed: 0 }, at: Date.now(),
};

function watch(page) {
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('response', (response) => {
    if (response.url().startsWith(baseURL) && response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });
  return problems;
}

async function noHorizontalScroll(page, where) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${where} overflows horizontally`);
}

async function simulateExclusiveCaptureAndSpeech(page) {
  await page.addInitScript(() => {
    // Safari/iOS can interrupt the camera when another capture is requested.
    // Make Chromium enforce that constraint so separate camera/mic requests fail.
    const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const audit = window.__captureAudit = { requests: [], streams: [], speechPauses: 0 };
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await nativeGetUserMedia(constraints);
      for (const old of audit.streams) old.getTracks().forEach((track) => track.stop());
      audit.requests.push({ video: !!constraints.video, audio: !!constraints.audio });
      audit.streams.push(stream);
      return stream;
    };

    // An iPhone may pause video playback while speaking an instruction. Keep
    // the end callback deterministic and require the app to resume the video.
    const pending = new Set();
    speechSynthesis.speak = (utterance) => {
      for (const video of document.querySelectorAll('video')) {
        if (!video.paused) audit.speechPauses++;
        video.pause();
      }
      let timer;
      const finish = () => {
        clearTimeout(timer);
        if (!pending.delete(finish)) return;
        utterance.onend?.(new Event('end'));
      };
      pending.add(finish);
      timer = setTimeout(finish, 80);
    };
    speechSynthesis.cancel = () => { for (const finish of [...pending]) finish(); };
  });
}

async function cameraKeepsRendering(page, where, { microphone = false, mirror = true } = {}) {
  await page.waitForFunction(() => window.engine?.src?.el?.videoWidth > 0 && !window.engine.isSpeaking);
  const state = await page.evaluate(() => {
    const video = window.engine.src.el;
    return {
      parent: video.parentElement?.id,
      tracks: video.srcObject.getVideoTracks().map((track) => track.readyState),
      time: video.currentTime,
      frame: window.engine.last?.t ?? 0,
      audio: window.engine.audio.running,
      audioTracks: window.engine.audio.stream?.getAudioTracks().map((track) => ({ state: track.readyState, enabled: track.enabled })) ?? [],
    };
  });
  assert.equal(state.parent, 'video-holder', `${where}: video remains mounted in its permanent holder`);
  assert.deepEqual(state.tracks, ['live'], `${where}: camera track stays live after microphone/speech`);
  if (microphone) {
    assert.equal(state.audio, true, `${where}: microphone analysis is running`);
    assert.ok(state.audioTracks.some((track) => track.state === 'live' && track.enabled), `${where}: microphone track is live and enabled`);
    const lastCapture = await page.evaluate(() => window.__captureAudit.requests.at(-1));
    assert.deepEqual(lastCapture, { video: true, audio: true }, `${where}: camera and microphone use a combined capture`);
  }
  await page.waitForFunction(({ time, frame }) => {
    const engine = window.engine;
    return engine.src.el.currentTime > time + 0.1 && engine.last?.t > frame + 100;
  }, state, { timeout: 5000 });
  if (mirror) {
    const rendered = await page.evaluate(() => {
      const canvas = document.querySelector('.mirror .mirror-media');
      if (!(canvas instanceof HTMLCanvasElement) || !canvas.width || !canvas.height) return false;
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < data.length; i += 64 * 4) {
        if (data[i + 3] > 0 && data[i] + data[i + 1] + data[i + 2] > 30) return true;
      }
      return false;
    });
    assert.equal(rendered, true, `${where}: visible mirror draws non-black camera pixels`);
  }
}

async function chromiumFlow(routine) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, permissions: ['camera', 'microphone'] });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const problems = watch(page);
    await simulateExclusiveCaptureAndSpeech(page);

    console.log('Checking Fono do Leo: hub tile and notebook home');
    await page.goto(baseURL);
    await page.locator('.fono-tile a').click();
    await page.waitForURL(/fono-do-leo/);
    // The published app exposes its test hooks only with ?dev.
    await page.goto(appURL);
    assert.equal(await page.locator('.ex-card').count(), routine.length);
    assert.equal(await page.locator('.site-link').getAttribute('href'), '../index.html');
    await noHorizontalScroll(page, 'fono home');

    console.log('Checking Fono do Leo: magic mirror loads the face model on the camera');
    await page.locator('.hero-go').click();
    await page.locator('.cal-screen').waitFor();
    await page.waitForFunction(() => window.engine?.tracker && window.engine.tracker.fps > 0);
    await page.waitForFunction(() => /espelho/i.test(document.querySelector('.cal-status')?.textContent ?? ''));
    await cameraKeepsRendering(page, 'calibration');

    console.log('Checking Fono do Leo: calibration → breathing keeps camera and microphone alive');
    await page.getByRole('button', { name: 'Continuar sem ajustar' }).click();
    await page.locator('.ex-screen.cat-respiracao').waitFor();
    await page.waitForFunction(() => window.engine?.audio.running);
    await page.locator('.ex-foot .btn-go').waitFor({ state: 'hidden' });
    await cameraKeepsRendering(page, 'breathing after the spoken intro', { microphone: true });
    assert.ok(await page.evaluate(() => window.__captureAudit.speechPauses > 0), 'speech simulation actually paused the source video');

    console.log('Checking Fono do Leo: camera survives exercise transitions and microphone cleanup');
    await page.getByRole('button', { name: 'Pular', exact: true }).click();
    await page.locator('.ex-title h1', { hasText: 'Língua para fora e para dentro' }).waitFor();
    await page.locator('.ex-foot .btn-go').waitFor({ state: 'hidden' });
    await cameraKeepsRendering(page, 'camera-only exercise after breathing');
    for (const title of ['Língua para um lado e para o outro', 'Língua para cima e para baixo', 'Estalar a língua']) {
      await page.getByRole('button', { name: 'Pular', exact: true }).click();
      await page.locator('.ex-title h1', { hasText: title }).waitFor();
      await page.locator('.ex-foot .btn-go').waitFor({ state: 'hidden' });
    }
    await cameraKeepsRendering(page, 'microphone exercise after camera-only exercises', { microphone: true });
    await page.locator('.ex-screen .icon-btn').click();
    await page.locator('.home').waitFor();
    assert.equal(await page.evaluate(() => window.engine.audio.running), false, 'leaving the routine stops microphone analysis');
    await cameraKeepsRendering(page, 'camera retained on returning to the notebook', { mirror: false });

    console.log('Checking Fono do Leo: an exercise finished with the parent\'s +1');
    await page.evaluate((b) => localStorage.setItem('leo-fono:baseline:v1', JSON.stringify(b)), BASELINE);
    await page.reload();
    await page.locator('.ex-card', { hasText: 'BICO E SORRISO' }).click();
    await page.locator('.ex-screen').waitFor();
    await page.locator('.loading').waitFor({ state: 'hidden' });
    // the intro may already have started the exercise on its own
    await page.locator('.btn-go', { hasText: 'Começar' }).click({ timeout: 3000 }).catch(() => {});
    await page.locator('.face-warn', { hasText: 'Cadê o Leo?' }).waitFor();
    await cameraKeepsRendering(page, 'camera-only exercise started from the notebook');
    await noHorizontalScroll(page, 'exercise');
    for (let i = 0; i < 10; i++) await page.locator('.plus').click();
    await page.locator('.done-overlay').waitFor();
    assert.equal(await page.locator('.ex-count b').textContent(), '10');
    const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('leo-fono:progress:v1')));
    const day = Object.values(progress.days)[0];
    assert.deepEqual([day.bicoSorriso.reps, day.bicoSorriso.manual, day.bicoSorriso.done], [10, 10, true]);
    assert.equal(progress.stickers.length, 1);
    await page.locator('.done-overlay .btn-go').click();
    await page.locator('.ex-card.done', { hasText: 'BICO E SORRISO' }).waitFor();

    console.log('Checking Fono do Leo: microphone exercise starts listening');
    await page.locator('.ex-card', { hasText: 'ESTALAR A LÍNGUA' }).click();
    await page.waitForFunction(() => window.engine?.audio.running);
    await page.locator('.ex-foot .btn-go').waitFor({ state: 'hidden' });
    await cameraKeepsRendering(page, 'camera upgraded to include microphone', { microphone: true });
    await page.locator('.ex-screen .icon-btn').click();
    await page.locator('.home').waitFor();
    assert.equal(await page.evaluate(() => window.engine.audio.running), false, 'leaving an exercise releases the microphone');

    console.log('Checking Fono do Leo: parent area behind a long press');
    await page.locator('.gear').dispatchEvent('pointerdown');
    await page.locator('.parent').waitFor();
    await page.locator('label', { hasText: 'Gargarejo' }).click();
    await page.locator('.parent .icon-btn').click();
    await page.locator('.ex-card', { hasText: 'GARGAREJO' }).locator('.off-tag').waitFor({ state: 'detached' });
    const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('leo-fono:settings:v1')));
    assert.equal(settings.routine.find((r) => r.id === 'gargarejo').on, true);

    await page.locator('.album-btn').click();
    assert.equal(await page.locator('.slot-sticker').count(), 1);

    assert.deepEqual(problems, [], 'browser errors or missing local files');
    console.log('PASS Chromium 390x844: exclusive capture, speech resume, live mirror across exercises, +1, parent area, album');

    console.log('Checking Fono do Leo: denied microphone keeps camera available');
    const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera', 'microphone'] });
    const deniedPage = await deniedContext.newPage();
    const deniedProblems = watch(deniedPage);
    await deniedPage.addInitScript((baseline) => {
      localStorage.setItem('leo-fono:baseline:v1', JSON.stringify(baseline));
      localStorage.setItem('leo-fono:settings:v1', JSON.stringify({ voice: false, sfx: false }));
      const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (constraints) => constraints.audio
        ? Promise.reject(new DOMException('Microphone permission denied', 'NotAllowedError'))
        : nativeGetUserMedia(constraints);
    }, BASELINE);
    await deniedPage.goto(appURL);
    await deniedPage.locator('.ex-card', { hasText: 'CHEIRAR A FLOR' }).click();
    await deniedPage.locator('.face-warn.error', { hasText: 'microfone' }).waitFor();
    await cameraKeepsRendering(deniedPage, 'microphone denied');
    assert.equal(await deniedPage.evaluate(() => window.engine.audio.running), false);
    assert.deepEqual(deniedProblems, [], 'browser errors when microphone permission is denied');
    await deniedContext.close();
    console.log('PASS microphone denied: camera and visible mirror keep running');
  } finally {
    await browser.close();
  }
}

async function webkitLayout(routine) {
  const browser = await webkit.launch({ headless: true });
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }]) {
      const page = await browser.newPage({ viewport, hasTouch: viewport.width < 600 });
      const problems = watch(page);
      await page.goto(appURL);
      assert.equal(await page.locator('.ex-card').count(), routine.length);
      await noHorizontalScroll(page, `WebKit home ${viewport.width}`);
      await page.locator('.album-btn').click();
      await page.locator('.album').waitFor();
      assert.deepEqual(problems, [], 'browser errors or missing local files');
      await page.close();
      console.log(`PASS WebKit ${viewport.width}x${viewport.height}: home and album`);
    }
  } finally {
    await browser.close();
  }
}

(async () => {
  // exercises.js is a plain data module: read it like site-smoke reads game-data.js
  const source = fs.readFileSync(path.join(__dirname, '../fono-do-leo/js/data/exercises.js'), 'utf8');
  const routine = vm.runInNewContext(`${source.replace(/^export /gm, '')}; EXERCISES`).filter((e) => e.routine);
  if (!process.env.BROWSER || process.env.BROWSER === 'chromium') await chromiumFlow(routine);
  if (!process.env.BROWSER || process.env.BROWSER === 'webkit') await webkitLayout(routine);
})().catch((error) => { console.error(error); process.exitCode = 1; });
