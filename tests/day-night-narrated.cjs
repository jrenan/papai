const assert = require('node:assert/strict');

async function verifyNarratedLesson(page, { name = 'Browser' } = {}) {
  const lessonURL = page.url();
  const manifestResponse = await page.request.get(new URL('audio/manifest.json', lessonURL).href);
  assert.ok(manifestResponse.ok(), `${name}: narration manifest is reachable`);
  const manifest = await manifestResponse.json();
  if (manifest.available !== true) {
    console.log(`SKIP ${name} real narration: audio bundle is not available yet`);
    return { skipped: true };
  }
  assert.equal(manifest.provider, 'ElevenLabs');
  assert.ok(Object.keys(manifest.clips || {}).length >= 25, 'the full guidance bundle is present');
  await Promise.all(Object.entries(manifest.clips).map(async ([id, clip]) => {
    assert.match(clip.file, /^[a-z0-9_-]+\.mp3$/i, `${id}: safe local MP3 filename`);
    const url = new URL(`audio/${clip.file}`, lessonURL);
    if (clip.sha256) url.searchParams.set('v', clip.sha256);
    const response = await page.request.get(url.href);
    assert.ok(response.ok(), `${name}: ${id} is missing (${response.status()})`);
    assert.ok((await response.body()).length > 128, `${name}: ${id} is empty`);
  }));

  // Preserve native decoding and playback; record only construction, play calls and errors.
  await page.addInitScript(() => {
    if (window.__dayNightNarrationAudit) return;
    const NativeAudio = window.Audio;
    const audit = { elements: [], plays: [], failures: [], maxPlaying: 0 };
    window.__dayNightNarrationAudit = audit;
    function ObservedAudio(...args) {
      const audio = new NativeAudio(...args);
      audit.elements.push(audio);
      const nativePlay = audio.play.bind(audio);
      audio.addEventListener('error', () => audit.failures.push({ src: audio.currentSrc || audio.src, error: `media:${audio.error?.code}` }));
      audio.addEventListener('playing', () => {
        audit.maxPlaying = Math.max(audit.maxPlaying, audit.elements.filter(element => !element.paused && !element.ended).length);
      });
      audio.play = (...playArgs) => {
        const src = audio.src;
        audit.plays.push(src);
        try {
          const result = nativePlay(...playArgs);
          return result?.catch(error => { audit.failures.push({ src, error: error.name }); throw error; });
        } catch (error) {
          audit.failures.push({ src, error: error.name }); throw error;
        }
      };
      return audio;
    }
    Object.setPrototypeOf(ObservedAudio, NativeAudio);
    ObservedAudio.prototype = NativeAudio.prototype;
    window.Audio = ObservedAudio;
  });
  await page.goto(lessonURL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#startVoiceButton') && !document.querySelector('#startVoiceButton').disabled);
  assert.equal(await page.locator('#lessonPanel').getAttribute('data-stage'), 'body');
  assert.match(await page.locator('#personLabel').textContent(), /Taubaté/);
  assert.match(await page.locator('#placeName').textContent(), /Taubaté/);
  assert.equal(await page.locator('#localTime').textContent(), '12:00');
  assert.equal(await page.evaluate(() => window.__dayNightNarrationAudit.plays.length), 0, 'nothing plays before the child taps');

  const action = value => page.locator(`#lessonPanel [data-lesson-action="${value}"]`).click();
  const answer = value => page.locator(`#lessonPanel [data-lesson-answer="${value}"]`).click();
  async function audible(id) {
    assert.ok(manifest.clips[id], `narration ${id} is in the generated bundle`);
    await page.waitForFunction(file => {
      const audit = window.__dayNightNarrationAudit;
      if (audit.failures.length) throw new Error(JSON.stringify(audit.failures));
      const audio = audit.elements[0];
      return audio && new URL(audio.currentSrc || audio.src, location.href).pathname.endsWith(`/${file}`)
        && !audio.paused && !audio.error && audio.currentTime > .08;
    }, manifest.clips[id].file, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__dayNightNarrationAudit.elements.length), 1, `${id}: one native Audio element`);
  }
  async function clock(value) {
    await page.waitForFunction(expected => document.querySelector('#localTime').textContent === expected, value);
    assert.equal(await page.locator('#localTime').getAttribute('datetime'), value);
  }

  await page.locator('#startVoiceButton').click(); await audible('lesson-body');
  await page.locator('#listenButton').click();
  assert.equal(await page.locator('#listenButton').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.evaluate(() => window.__dayNightNarrationAudit.elements[0].paused), true);
  await page.locator('#listenButton').click(); await audible('lesson-body');
  assert.equal(await page.evaluate(() => window.__dayNightNarrationAudit.plays.filter(url => url.includes('/lesson-body.mp3')).length), 2, 'replay starts the current instruction again');

  for (const predicted of ['day', 'night']) {
    if (predicted === 'night') { await page.locator('#startLesson').click(); await audible('lesson-body'); }
    await action(predicted === 'day' ? 'body-done' : 'body-imagine'); await audible('lesson-compare');
    await action('next'); await audible('lesson-predict');
    await answer(predicted); await audible(`prediction-${predicted}`);
    await action('next'); await audible('lesson-rotate');
    await action('turn'); await audible(`observed-${predicted}`); await clock('00:00');
    await action('next'); await audible('lesson-explain');
    if (predicted === 'day') {
      await answer('sun-off'); await audible('cause-sun-off');
      assert.equal(await page.locator('#lessonNext').isDisabled(), true);
      await answer('away'); await audible('cause-away');
    }
    await answer('earth'); await audible('cause-correct');
    await action('next'); await audible('lesson-transfer'); await clock('00:00');
    const transfer = predicted === 'day' ? 'night' : 'day';
    await answer(transfer); await audible(`transfer-${transfer}`); await clock('12:00');
    assert.equal(await page.locator('#clockPlace').textContent(), 'Outro lugar');
    await action('view-home'); await audible('view-home'); await clock('00:00');
    assert.equal(await page.locator('#clockPlace').textContent(), 'Taubaté');
    await action('view-other'); await audible('view-other'); await clock('12:00');
    await action('finish'); await audible('lesson-finish');
  }
  assert.equal(await page.locator('#lessonPanel').isVisible(), false);
  for (const [phase, time] of [['day', '12:00'], ['sunset', '18:00'], ['night', '00:00'], ['sunrise', '06:00']]) {
    await page.locator(`button[data-phase="${phase}"]`).click();
    await audible(phase); await clock(time);
    assert.equal(await page.locator('#clockPlace').textContent(), 'Taubaté');
  }
  await page.locator('#listenButton').click();
  assert.equal(await page.locator('#listenButton').getAttribute('aria-pressed'), 'false');
  const playsBeforeReset = await page.evaluate(() => window.__dayNightNarrationAudit.plays.length);
  await page.locator('button[data-phase="day"]').click(); await clock('12:00');
  await page.waitForFunction(() => Number(document.querySelector('#rotation').value) === 0);
  const audit = await page.evaluate(() => {
    const value = window.__dayNightNarrationAudit;
    return { instances: value.elements.length, plays: value.plays.length, paused: value.elements.every(audio => audio.paused), failures: value.failures, maxPlaying: value.maxPlaying };
  });
  assert.equal(audit.instances, 1); assert.equal(audit.maxPlaying, 1);
  assert.equal(audit.paused, true); assert.equal(audit.plays, playsBeforeReset);
  assert.deepEqual(audit.failures, [], 'native MP3 playback never failed or was rejected');
  console.log(`PASS ${name} real narration: native MP3 playback, gesture/replay/pause, all guided branches, one Audio element, Taubaté and 24-hour clock`);
  return { skipped: false };
}

module.exports = { verifyNarratedLesson };
