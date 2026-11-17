const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Runs inside the caller's existing browser/page; leaves that page in free play.
async function verifyLesson(page, { name, qaDirectory, captureScreenshots = true }) {
  const panel = page.locator('#lessonPanel');
  const range = page.locator('#rotation');
  const originalViewport = page.viewportSize() || { width: 1280, height: 900 };
  const prefix = `lesson-${String(name).toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
  fs.mkdirSync(qaDirectory, { recursive: true });

  async function frames() {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  async function stage(expected) {
    await page.waitForFunction(value => document.querySelector('#lessonPanel').dataset.stage === value, expected);
    assert.equal(await panel.isVisible(), true, `${name}: ${expected} panel remains visible`);
  }
  async function action(value) {
    await panel.locator(`[data-lesson-action="${value}"]`).click();
  }
  async function answer(value) {
    await panel.locator(`[data-lesson-answer="${value}"]`).click();
  }
  async function phase(expected) {
    await page.waitForFunction(value => document.querySelector('#phaseTitle').dataset.phase === value, expected);
  }
  async function angleIs(expected, label) {
    assert.ok(Math.abs(Number(await range.inputValue()) - expected) < .1, `${name}: ${label}`);
  }
  async function noHorizontalOverflow(label) {
    const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(metrics.scroll <= metrics.width + 1, `${name}: ${label} has no horizontal overflow (${metrics.scroll}/${metrics.width})`);
  }
  async function capture(label, responsive = false) {
    const sizes = responsive
      ? [originalViewport, { width: 390, height: 844 }, { width: 844, height: 390 }]
      : [originalViewport];
    for (const viewport of sizes) {
      await page.setViewportSize(viewport);
      await frames();
      await noHorizontalOverflow(`${label} ${viewport.width}×${viewport.height}`);
      if (captureScreenshots) await page.screenshot({ path: path.join(qaDirectory, `${prefix}-${label}-${viewport.width}x${viewport.height}.png`), fullPage: true });
    }
    await page.setViewportSize(originalViewport);
    await frames();
  }
  async function freePlayRestored(label) {
    assert.equal(await panel.isVisible(), false, `${name}: ${label} closes the lesson`);
    assert.equal(await range.isDisabled(), false, `${name}: ${label} unlocks rotation`);
    assert.equal(await page.locator('#spaceCanvas').getAttribute('aria-disabled'), 'false');
    for (const selector of ['#playButton', '#resetButton', '#challengeButton', '#crewMotion', 'button[data-phase="day"]']) {
      assert.equal(await page.locator(selector).isVisible(), true, `${name}: ${label} restores ${selector}`);
    }
    assert.equal(await page.locator('#otherPlaceLabel').isVisible(), false, `${name}: ${label} removes the temporary second marker`);
    assert.equal(await page.locator('#skyView').getAttribute('data-observer'), 'home');
  }

  await stage('body');
  assert.equal(await page.locator('body').getAttribute('data-lesson-active'), 'true', 'guided activity opens by default');
  assert.equal(await range.isDisabled(), true, 'rotation waits while the body/model analogy is introduced');
  assert.equal(await page.locator('#rotationLabel').textContent(), 'Posição da Terra');
  assert.equal(await page.locator('#spaceCanvas').getAttribute('aria-disabled'), 'true');
  assert.equal(await panel.locator('[data-lesson-action="exit"]').isVisible(), true, 'free play is always available');
  assert.equal(await page.locator('button[data-phase="day"]').isVisible(), false, 'phase shortcuts cannot reveal the prediction answer');
  await capture('body', true);

  await action('body-imagine');
  await stage('compare');
  assert.match(await panel.locator('.lesson-mapping').textContent(), /corpo.*Terra.*rosto.*ponto rosa.*criança/s);
  await action('next');
  await stage('predict');
  assert.equal(await page.locator('#lessonNext').isDisabled(), true, 'testing requires a prediction first');
  await answer('day'); // Deliberately incorrect: feedback must wait for the experiment.
  assert.equal(await page.locator('#lessonNext').isDisabled(), false);
  assert.equal(await panel.getAttribute('data-result'), 'predicted');
  assert.doesNotMatch(await page.locator('#lessonFeedback').textContent(), /noite|errad[oa]|corret[oa]|acertou/i, 'a prediction is acknowledged without disclosing correctness');
  assert.equal(await page.locator('button[data-phase="day"]').isVisible(), false);

  await action('next');
  await stage('rotate');
  assert.equal(await range.isDisabled(), false, 'the child can manipulate Earth during the experiment');
  assert.equal(await page.locator('#lessonNext').isDisabled(), true, 'the explanation waits for the observation');
  await angleIs(0, 'the half-turn demonstration starts in daylight');
  await capture('rotate');
  await action('turn');
  await page.waitForFunction(() => document.querySelector('#lessonPanel').dataset.result === 'observed');
  await phase('night');
  await angleIs(180, 'the demonstration ends after half a turn');
  assert.equal(await range.isDisabled(), true, 'the model pauses on the result for comparison');
  assert.equal(await page.locator('#lessonNext').isDisabled(), false);
  assert.match(await page.locator('#lessonFeedback').textContent(), /imaginou dia.*sem a luz do Sol.*noite/s, 'feedback compares the prediction with the observed cause');

  await action('next');
  await stage('explain');
  await answer('sun-off');
  assert.equal(await panel.getAttribute('data-result'), 'retry');
  assert.equal(await page.locator('#lessonNext').isDisabled(), true, 'a misconception gets an explanation before proceeding');
  assert.match(await page.locator('#lessonFeedback').textContent(), /continua aceso/i);
  await answer('earth');
  assert.equal(await panel.getAttribute('data-result'), 'explained');
  assert.equal(await page.locator('#lessonNext').isDisabled(), false);
  await capture('explain');

  await action('next');
  await stage('transfer');
  await phase('night');
  await angleIs(180, 'the transfer task keeps Earth in the observed position');
  assert.equal(await page.locator('#localTime').textContent(), '00:00');
  assert.match(await page.locator('#skyHeading').textContent(), /Taubaté/i, 'the other sky is not revealed before a choice');
  assert.equal(await page.locator('#skyView').getAttribute('data-observer'), 'home');
  assert.equal(await page.locator('#otherPlaceLabel').isVisible(), true, 'the new location is visible on the same Earth');
  assert.equal(await panel.locator('[data-lesson-action="view-other"]').count(), 0, 'the answer view waits for the transfer choice');
  assert.equal(await page.locator('#lessonFeedback').textContent(), '');
  await answer('night'); // Deliberately incorrect: the second view provides the comparison.
  await phase('day');
  assert.equal(await page.locator('#localTime').textContent(), '12:00', 'the opposite location has its own simulated local time');
  assert.equal(await panel.getAttribute('data-result'), 'compared');
  assert.match(await page.locator('#skyHeading').textContent(), /outro lugar/i);
  assert.equal(await page.locator('#placeLegend').getAttribute('data-observer'), 'other');
  assert.match(await page.locator('#placeLegendText').textContent(), /Outro lugar/);
  await angleIs(180, 'switching location does not turn Earth');
  assert.match(await page.locator('#lessonFeedback').textContent(), /outro lugar é dia.*Ao mesmo tempo.*noite/s);
  await capture('transfer', true);

  await action('view-home');
  await phase('night');
  assert.equal(await page.locator('#placeLegend').getAttribute('data-observer'), 'home');
  await angleIs(180, 'returning home keeps the same instant');
  assert.equal(await panel.locator('[data-lesson-action="view-home"]').getAttribute('aria-pressed'), 'true');
  await action('view-other');
  await phase('day');
  await angleIs(180, 'viewing the other place again keeps the same instant');
  assert.equal(await panel.locator('[data-lesson-action="view-other"]').getAttribute('aria-pressed'), 'true');
  await action('finish');
  await freePlayRestored('finishing');

  await page.locator('#startLesson').click();
  await stage('body');
  assert.equal(await range.isDisabled(), true, 'restarting locks the introduction again');
  await angleIs(0, 'restarting returns to the initial daylight scene');
  await action('body-imagine');
  await action('next');
  await stage('predict');
  assert.equal(await page.locator('#lessonNext').isDisabled(), true, 'a new run clears the previous prediction');
  await answer('day');
  await action('exit');
  await freePlayRestored('leaving mid-prediction');
  await page.locator('#startLesson').click();
  await stage('body');
  assert.equal(await panel.getAttribute('data-result'), '', 'restart clears prior feedback state');
  await action('exit');
  await freePlayRestored('leaving the restarted introduction');
  await page.setViewportSize(originalViewport);
  await page.locator('#resetButton').click();
  await frames();
  console.log(`PASS ${name} guided lesson: prediction before observation, causal feedback/retry, opposite-place transfer at the same angle, escape/restart and responsive layouts`);
}

module.exports = { verifyLesson };
