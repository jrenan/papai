const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8000';

async function startMission(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => restartGame());
}

async function dropPoint(page, habitatId) {
  return page.evaluate((id) => {
    const svg = document.querySelector('#rescueMap');
    const position = BIOME_GEOMETRY[id].labelPosition;
    const point = new DOMPoint(position.x, position.y - 14).matrixTransform(svg.getScreenCTM());
    return { x: point.x, y: point.y, habitatId: biomeAtPoint(point.x, point.y)?.habitatId };
  }, habitatId);
}

async function verify(engine) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1600 },
      reducedMotion: 'reduce',
      hasTouch: true,
    });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Biomes works offline; do not make these regression cases depend on globe CDN scripts.
    await page.route('https://unpkg.com/**', (route) => route.abort());
    await startMission(page);

    const explore = page.locator('[data-action="explore"]').first();
    await explore.press('Enter');
    assert.equal(await explore.evaluate((element) => element === document.activeElement), true,
      'investigating a place must preserve keyboard focus');
    await page.locator('#rescueToken').press('Enter');
    assert.equal(await page.locator('#rescueToken').getAttribute('aria-pressed'), 'true');
    await page.locator('#rescueMap [data-rescue-biome="caatinga"]').press('Enter');
    assert.equal(await page.locator('#rescueToken').getAttribute('aria-pressed'), 'false',
      'a rejected keyboard drop must release the token');
    assert.equal(await page.locator('#rescueToken').evaluate((element) => element === document.activeElement), true);
    await page.keyboard.press('Space');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#rescueToken').getAttribute('aria-pressed'), 'false');
    await page.keyboard.press('Enter');
    await page.locator('#rescueMap [data-rescue-biome="pantanal"]').press('Enter');
    await page.waitForFunction(() => document.activeElement?.classList.contains('adaptation-option'));
    assert.equal(await page.locator('#rescueToken').isDisabled(), true);

    // Hold a landing animation open, advance the mission, then finish the old animation.
    const races = await page.evaluate(async () => {
      const oldAnimation = window.animateGhostTo;
      const oldScroll = adaptationCard.scrollIntoView;
      let release;
      const makeGhost = () => {
        const ghost = document.createElement('div');
        ghost.className = 'rescue-ghost';
        document.body.append(ghost);
        return ghost;
      };
      window.animateGhostTo = () => new Promise((resolve) => { release = resolve; });
      try {
        restartGame();
        dropOnBiome('pantanal', { ghost: makeGhost() });
        chooseAdaptation('pernas compridas');
        nextMission();
        release();
        await new Promise((resolve) => setTimeout(resolve, 0));
        const nextEnabled = !rescueToken.disabled;
        restartGame();
        dropOnBiome('pantanal', { ghost: makeGhost() });
        openHub();
        let scrolls = 0;
        adaptationCard.scrollIntoView = () => { scrolls += 1; };
        release();
        await new Promise((resolve) => setTimeout(resolve, 0));
        return { nextEnabled, scrolls, ghosts: document.querySelectorAll('.rescue-ghost').length };
      } finally {
        adaptationCard.scrollIntoView = oldScroll;
        window.animateGhostTo = oldAnimation;
      }
    });
    assert.deepEqual(races, { nextEnabled: true, scrolls: 0, ghosts: 0 },
      'old landing animations must not disable a new mission or scroll the menu');

    await startMission(page);
    const token = await page.locator('#rescueToken').boundingBox();
    const target = await dropPoint(page, 'pantanal');
    assert.equal(target.habitatId, 'pantanal', 'drag target must be inside Pantanal');
    await page.mouse.move(token.x + token.width / 2, token.y + token.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('#rescueToken').disabled);
    assert.equal(await page.locator('#rescueMap .rescued-marker').count(), 1);

    await page.setViewportSize({ width: 390, height: 844 });
    await startMission(page);
    await page.locator('#rescueToken').tap();
    assert.equal(await page.locator('#rescueToken').getAttribute('aria-pressed'), 'true',
      'a touch must activate carrying without requiring a drag');
    const touchTarget = await dropPoint(page, 'pantanal');
    assert.equal(touchTarget.habitatId, 'pantanal');
    await page.touchscreen.tap(touchTarget.x, touchTarget.y);
    await page.waitForFunction(() => document.querySelector('#rescueToken').disabled);
    assert.equal(await page.locator('#rescueMap .rescued-marker').count(), 1);
    assert.deepEqual(errors, [], 'browser errors');
    console.log(`PASS ${engine.name()}: biome focus, keyboard retry/Escape, stale animations, real drag and mobile taps`);
  } finally {
    await browser.close();
  }
}

(async () => {
  await verify(chromium);
  await verify(webkit);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
