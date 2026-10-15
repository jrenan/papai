const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium, webkit } = require('playwright');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const game = vm.runInNewContext(`${fs.readFileSync(path.join(__dirname, '../game-data.js'), 'utf8')}; GAME_DATA`);

async function verify(engine, name, viewport) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport, hasTouch: viewport.width < 600, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);
    const errors = [];
    const failedLocalRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(baseURL) && response.status() >= 400) {
        failedLocalRequests.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.goto(baseURL);
    assert.equal(await page.locator('.game-tile').count(), 4);
    assert.equal(await page.locator('.numberblocks-preview .nb').count(), 3);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'hub overflows horizontally');

    await page.locator('[data-open-game="biomes"]').click();
    await page.locator('#startButton').click();
    for (const [index, mission] of game.missions.entries()) {
      console.log(`Checking ${name}: biome mission ${index + 1}`);
      const animal = game.species[mission.species];
      const target = animal.preferredHabitats[0];
      for (const habitat of mission.habitats) {
        await page.locator(`[data-action="explore"][data-habitat="${habitat}"]`).click();
      }
      assert.equal(await page.locator('.habitat-card.is-explored').count(), 3);
      if (index === 0) {
        await page.locator('#rescueToken').press('Enter');
        await page.locator('#rescueMap [data-rescue-biome="caatinga"]').press('Enter');
        assert.equal(await page.locator('#rescueToken').isDisabled(), false);
        assert.equal(await page.locator('#rescueToken').getAttribute('aria-pressed'), 'false');
        assert.equal(await page.locator('#rescueMap .rescued-marker').count(), 0);
      }
      await page.locator('#rescueToken').press('Enter');
      await page.locator(`#rescueMap [data-rescue-biome="${target}"]`).press('Enter');
      await page.waitForFunction(() => document.querySelector('#rescueToken').disabled);
      assert.equal(await page.locator('#rescueMap .rescued-marker').count(), index + 1);
      const wrong = animal.adaptation.options.find(option => option !== animal.adaptation.answer);
      await page.getByRole('button', { name: wrong, exact: true }).click();
      assert.equal(await page.locator('#nextButton').isVisible(), false);
      await page.getByRole('button', { name: animal.adaptation.answer, exact: true }).click();
      await page.locator('#nextButton').click();
    }
    await page.locator('#completeCard').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#completeMap .rescued-marker').count(), 6);
    await page.locator('#restartButton').click();
    assert.equal(await page.locator('#rescueMap .rescued-marker').count(), 0);
    assert.equal(await page.locator('#rescueToken').isDisabled(), false);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mission overflows horizontally');
    await page.locator('#mission [data-back-hub]').click();

    await page.locator('[data-open-game="world"]').click();
    console.log(`Checking ${name}: world data`);
    await page.waitForFunction(() => document.querySelectorAll('#countryStrip [data-country]').length > 100);
    assert.match(await page.locator('#sourceStatus').textContent(), /dados locais/);
    await page.locator('#toggleCountryBrowser').click();
    await page.locator('#countrySearch').fill('Brasil');
    assert.equal(await page.locator('#countryStrip [data-country]').count(), 1);
    await page.locator('#countryStrip [data-country]').click();
    assert.equal(await page.locator('#countryName').textContent(), 'Brasil');
    assert.ok((await page.locator('#countryCapital').textContent()).length > 0);
    await page.locator('#closeCountryPanel').click();
    await page.locator('#pauseGlobeButton').click();
    assert.equal(await page.locator('#pauseGlobeButton').getAttribute('aria-label'), 'Retomar globo');
    assert.deepEqual(errors, [], 'browser errors');
    assert.deepEqual(failedLocalRequests, [], 'local assets failed to load');
    console.log(`PASS ${name} ${viewport.width}x${viewport.height}: hub, six biome missions, wrong answers, restart, world data/search`);
  } finally {
    await browser.close();
  }
}

(async () => {
  if (!process.env.BROWSER || process.env.BROWSER === 'chromium') await verify(chromium, 'Chromium', { width: 1280, height: 900 });
  if (!process.env.BROWSER || process.env.BROWSER === 'webkit') await verify(webkit, 'WebKit', { width: 390, height: 844 });
})().catch(error => { console.error(error); process.exitCode = 1; });
