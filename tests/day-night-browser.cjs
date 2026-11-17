/* BASE_URL=http://127.0.0.1:8000 BROWSER=chromium node tests/day-night-browser.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const { verifyLesson } = require('./day-night-lesson.cjs');
const { verifySunset } = require('./day-night-sunset.cjs');
const { verifyNarratedLesson } = require('./day-night-narrated.cjs');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const qaDirectory = process.env.QA_DIR || '/tmp/trio-day-night-qa';
const phaseLabels = {
  day: /dia|meio-dia/i,
  sunset: /entardecer|pôr do sol/i,
  night: /noite/i,
  sunrise: /amanhecer|nascer do sol/i,
};
const viewportSizes = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
];

async function verifyLayout(page, label) {
  const layout = await page.evaluate(() => {
    const elements = ['#spaceCanvas', '#skyCanvas', '#playButton', '#rotation', '#challengeButton'];
    if (!document.querySelector('#listenButton').hidden) elements.push('#listenButton');
    return {
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      boxes: elements.map(selector => {
        const element = document.querySelector(selector);
        if (!element) return { selector, missing: true };
        const box = element.getBoundingClientRect();
        return { selector, x: box.x, width: box.width, height: box.height };
      }),
    };
  });
  assert.ok(layout.scrollWidth <= layout.viewport + 1, `${label}: no horizontal overflow`);
  for (const box of layout.boxes) {
    assert.ok(!box.missing, `${label}: ${box.selector} exists`);
    assert.ok(box.width > 20 && box.height > 15, `${label}: ${box.selector} remains usable`);
    assert.ok(box.x >= -1 && box.x + box.width <= layout.viewport + 1, `${label}: ${box.selector} stays within screen width`);
  }
}

async function waitForPhase(page, phase) {
  await page.waitForFunction(expected => {
    const state = window.DayNightModel.getState(Number(document.querySelector('#rotation').value) * Math.PI / 180);
    return state.phase === expected;
  }, phase);
  assert.match(await page.locator('#phaseTitle').textContent(), phaseLabels[phase]);
  assert.equal(await page.locator('#phaseTitle').getAttribute('data-phase'), phase, 'visible phase matches the model');
  assert.ok((await page.locator('#phaseText').textContent()).trim().length > 12, `${phase} includes an explanation`);
}

async function choosePhase(page, phase) {
  await page.locator(`button[data-phase="${phase}"]`).click();
  await page.waitForFunction(expected => {
    const value = Number(document.querySelector('#rotation').value);
    const target = { day: 0, sunset: 90, night: 180, sunrise: 270 }[expected];
    const difference = Math.abs(value - target) % 360;
    return Math.min(difference, 360 - difference) < 0.1;
  }, phase);
  await waitForPhase(page, phase);
  assert.equal(await page.locator('#localTime').textContent(), { day: '12:00', sunset: '18:00', night: '00:00', sunrise: '06:00' }[phase], 'the 24-hour teaching clock follows Earth rotation');
  assert.equal(await page.locator('#clockPlace').textContent(), 'Taubaté');
  assert.match(await page.locator('#personLabel').textContent(), /Taubaté/);
  assert.equal(await page.locator('#playButton').getAttribute('aria-pressed'), 'false', 'choosing a moment pauses automatic rotation');
}

async function setRotation(page, degrees) {
  await page.locator('#rotation').evaluate((input, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, degrees);
}

async function verify(engine, name) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: viewportSizes[0], reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    const errors = [], failedRequests = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    page.on('response', response => {
      if (response.url().startsWith(baseURL) && response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(baseURL);
    await page.locator('a[href="dia-e-noite/"]').click();
    await page.waitForURL('**/dia-e-noite/');
    await page.waitForFunction(() => Boolean(window.DayNightModel));
    await page.locator('#spaceCanvas').waitFor({ state: 'visible' });
    await page.locator('#skyCanvas').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.body.dataset.renderer);
    const manifest = await (await page.request.get(`${baseURL}/dia-e-noite/audio/manifest.json`)).json();
    if (manifest.available === false) await page.locator('#listenButton').waitFor({ state: 'hidden' });
    await verifyLesson(page, { name, qaDirectory });
    if (manifest.available === false) assert.equal(await page.locator('#voicePrompt').isVisible(), false, 'unavailable narration stays hidden throughout the lesson');
    if (manifest.available !== false) await verifyNarratedLesson(page, { name });
    await verifySunset(page, { name, qaDirectory });
    await page.waitForFunction(() => Boolean(window.TrioAstronauts));
    assert.equal(await page.locator('#crewMotion').getAttribute('aria-pressed'), 'true', 'reduced motion starts with still astronauts');
    const crewBefore = await page.locator('#spaceCanvas').screenshot();
    const earthBeforeCrew = await page.locator('#rotation').inputValue();
    await page.locator('#crewMotion').click();
    await page.waitForTimeout(450);
    const crewAfter = await page.locator('#spaceCanvas').screenshot();
    assert.equal(crewBefore.equals(crewAfter), false, 'astronauts float when motion is enabled');
    assert.equal(await page.locator('#rotation').inputValue(), earthBeforeCrew, 'floating astronauts do not rotate the Earth');
    await page.locator('#crewMotion').click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const crewPaused = await page.locator('#spaceCanvas').screenshot();
    await page.waitForTimeout(200);
    assert.equal(crewPaused.equals(await page.locator('#spaceCanvas').screenshot()), true, 'astronaut motion can be paused');

    const skyFrames = {};
    fs.mkdirSync(qaDirectory, { recursive: true });
    for (const phase of ['day', 'sunset', 'night', 'sunrise']) {
      await choosePhase(page, phase);
      if (phase === 'day' || phase === 'night') skyFrames[phase] = await page.locator('#skyCanvas').screenshot();
      await page.screenshot({ path: path.join(qaDirectory, `${name.toLowerCase()}-${phase}.png`), fullPage: true });
    }
    assert.equal(skyFrames.day.equals(skyFrames.night), false, 'the child’s sky visually changes between day and night');
    await choosePhase(page, 'day');
    const pausedPosition = await page.locator('#rotation').inputValue();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#rotation').inputValue(), pausedPosition, 'paused Earth stays still');
    await page.locator('#playButton').click();
    assert.equal(await page.locator('#playButton').getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(initial => document.querySelector('#rotation').value !== initial, pausedPosition);
    await page.locator('#playButton').click();
    assert.equal(await page.locator('#playButton').getAttribute('aria-pressed'), 'false');

    await choosePhase(page, 'day');
    const canvasBox = await page.locator('#spaceCanvas').boundingBox();
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.60, canvasBox.y + canvasBox.height * 0.52);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.83, canvasBox.y + canvasBox.height * 0.52, { steps: 12 });
    await page.mouse.up();
    assert.notEqual(Number(await page.locator('#rotation').inputValue()), 0, 'dragging the globe changes the moment shown on Earth');
    assert.equal(await page.locator('#playButton').getAttribute('aria-pressed'), 'false', 'manual dragging stays under the child’s control');

    await page.locator('#resetButton').click();
    for (let repeat = 0; repeat < 4; repeat++) {
      await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + canvasBox.width * 0.75, canvasBox.y + canvasBox.height * 0.5, { steps: 6 });
      await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5, { steps: 6 });
      await page.mouse.up();
    }
    assert.doesNotMatch(await page.locator('#challengeStatus').textContent(), /Uma volta inteira/, 'rocking back and forth does not count as a full rotation');

    const beforeKeyboard = Number(await page.locator('#rotation').inputValue());
    await page.locator('#rotation').focus();
    await page.keyboard.press('ArrowRight');
    assert.notEqual(Number(await page.locator('#rotation').inputValue()), beforeKeyboard, 'keyboard can rotate the Earth');
    await setRotation(page, 180);
    await waitForPhase(page, 'night');
    await setRotation(page, 0);
    await waitForPhase(page, 'day');

    await page.locator('#challengeButton').click();
    await waitForPhase(page, 'night');
    assert.equal(await page.locator('#challengeStatus').getAttribute('data-status'), 'active');
    const challengePrompt = (await page.locator('#challengeStatus').textContent()).trim();
    assert.ok(challengePrompt.length > 10, 'the challenge explains what to do');
    await setRotation(page, 0);
    await waitForPhase(page, 'day');
    await page.waitForFunction(prompt => document.querySelector('#challengeStatus').textContent.trim() !== prompt, challengePrompt);
    assert.equal(await page.locator('#challengeStatus').getAttribute('data-status'), 'complete');
    assert.ok((await page.locator('#challengeStatus').textContent()).trim().length > 5, 'the challenge acknowledges the child reaching daylight');

    fs.mkdirSync(qaDirectory, { recursive: true });
    for (const viewport of viewportSizes) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await verifyLayout(page, `${name} ${viewport.width}×${viewport.height}`);
      await page.screenshot({ path: path.join(qaDirectory, `${name.toLowerCase()}-${viewport.width}x${viewport.height}.png`), fullPage: true });
    }
    assert.equal(requests.some(url => /api\.elevenlabs\.io/.test(url)), false, 'the child’s browser never accesses ElevenLabs credentials or API');
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    assert.deepEqual(failedRequests, [], 'all local runtime files load');

    // Disable WebGL before the app initializes, as on unsupported devices.
    const fallback = await browser.newPage({ viewport: viewportSizes[1], reducedMotion: 'reduce' });
    const fallbackErrors = [];
    fallback.on('pageerror', error => fallbackErrors.push(error.message));
    await fallback.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/i.test(type) ? null : getContext.call(this, type, ...args);
      };
    });
    await fallback.goto(`${baseURL}/dia-e-noite/`);
    await verifyLesson(fallback, { name: `${name} fallback`, qaDirectory, captureScreenshots: false });
    await verifySunset(fallback, { name: `${name} fallback`, qaDirectory });
    await choosePhase(fallback, 'night');
    await choosePhase(fallback, 'day');
    assert.equal(await fallback.locator('body').getAttribute('data-renderer'), '2d', 'unsupported graphics use the lightweight renderer');
    await verifyLayout(fallback, `${name} without WebGL`);
    assert.deepEqual(fallbackErrors, [], 'devices without WebGL retain a working lesson');
    await fallback.screenshot({ path: path.join(qaDirectory, `${name.toLowerCase()}-fallback.png`), fullPage: true });
    await fallback.close();
    const animated = await browser.newPage({ viewport: viewportSizes[0], reducedMotion: 'no-preference' });
    await animated.goto(`${baseURL}/dia-e-noite/`);
    await animated.locator('[data-lesson-action="body-imagine"]').click();
    await animated.locator('#lessonNext').click();
    await animated.locator('[data-lesson-answer="night"]').click();
    await animated.locator('#lessonNext').click();
    await animated.locator('[data-lesson-action="turn"]').click();
    await animated.waitForFunction(() => { const value = Number(document.querySelector('#rotation').value); return value > 20 && value < 170; });
    await animated.waitForFunction(() => document.querySelector('#lessonPanel').dataset.result === 'observed');
    assert.equal(Number(await animated.locator('#rotation').inputValue()), 180, 'the animated demonstration makes exactly half a turn and stops');
    await animated.close();
    console.log(`PASS ${name} day/night: astronauts float/pause independently, reduced motion, four moments, free drag, keyboard, challenge, three viewports and no-WebGL fallback`);
  } finally {
    await browser.close();
  }
}

(async () => {
  if (!process.env.BROWSER || process.env.BROWSER === 'chromium') await verify(chromium, 'Chromium');
  if (!process.env.BROWSER || process.env.BROWSER === 'webkit') await verify(webkit, 'WebKit');
})().catch(error => { console.error(error); process.exitCode = 1; });
