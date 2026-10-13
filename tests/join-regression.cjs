// Run with a local static server: BASE_URL=http://127.0.0.1:8000 node tests/join-regression.cjs
// Requires Playwright and its Chromium browser; uses only the game's public UI.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8000';

async function activate(page, locator, keyboard, key = 'Enter') {
  if (keyboard) await locator.press(key);
  else if (page.viewportSize().width < 800) await locator.tap();
  else await locator.click();
}

async function assertCharactersFit(page) {
  const geometry = await page.evaluate(() => {
    const ground = document.getElementById('ground').getBoundingClientRect();
    const blocks = [...document.querySelectorAll('.fig .nb-b')].map(el => el.getBoundingClientRect());
    const toolbar = [...document.querySelectorAll('#top button')].map(el => el.getBoundingClientRect());
    return {
      blocksFit: blocks.every(r => r.top >= ground.top && r.bottom <= ground.bottom && r.left >= ground.left && r.right <= ground.right),
      toolbarFits: toolbar.every(r => r.left >= 0 && r.right <= innerWidth),
    };
  });
  assert.equal(geometry.blocksFit, true, 'All blocks must fit in the ground');
  assert.equal(geometry.toolbarFits, true, 'Toolbar controls must fit in the viewport');
}

async function buildFriends(page, keyboard) {
  for (let step = 1; step <= 2; step++) {
    await page.locator(`.scene[data-step="${step}"]`).waitFor();
    await assertCharactersFit(page);
    const count = await page.locator('[data-fig="T"] .nb-b.vazio').count();
    for (let i = 0; i < count; i++) {
      const source = page.locator('.src');
      await activate(page, source, keyboard, i % 2 ? 'Space' : 'Enter');
    }
    const next = page.locator('[data-act="next"]');
    await next.waitFor();
    assert.equal(await page.locator('[data-fig="T"] .nb-b.vazio').count(), 0);
    await activate(page, next, keyboard);
  }
}

async function solveRound(page, { keyboard, assisted }) {
  await buildFriends(page, keyboard);
  const friend = page.locator('[data-fig="A"]');
  await activate(page, friend, keyboard);
  await page.waitForFunction(() => document.querySelector('#bubble')?.textContent.includes('Juntos!'));
  // A solved previous round must never reveal this answer before counting.
  assert.equal(await page.locator('[data-fig="M"] .nb.sem-rosto').count(), 1);
  assert.equal(await page.locator('[data-fig="M"] .nb-num').textContent(), '?');
  await assertCharactersFit(page);
  const total = await page.locator('[data-fig="M"] .nb-b').count();
  const operands = await page.locator('.eq .chip').allTextContents();
  assert.equal(total, operands.reduce((sum, value) => sum + Number(value), 0));
  // Merge ends on a timer even with reduced motion.
  await page.waitForTimeout(60);
  if (assisted) {
    await page.locator('[data-act="count"]').press('Enter');
  } else {
    for (let i = total - 1; i >= 0; i--) {
      await activate(page, page.locator(`[data-fig="M"] .nb-b[data-i="${i}"]`), false);
    }
  }
  await page.locator('.scene[data-step="4"]').waitFor();
  assert.equal(await page.locator('.nb-conta').count(), total);
  const wrong = page.locator(`.opt:not([data-val="${total}"])`).first();
  await activate(page, wrong, keyboard, 'Space');
  assert.equal(await page.locator('.opt.bad:disabled').count(), 1);
  const correct = page.locator(`.opt[data-val="${total}"]`);
  await activate(page, correct, keyboard);
  await page.locator('[data-act="new"]').waitFor();
  assert.equal(await page.locator('[data-fig="M"] .nb.sem-rosto').count(), 0);
  assert.equal(Number(await page.locator('.ans.ok').textContent()), total);
}

async function animatedDragRound(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseURL}/numberblocks-somar/`);
  await page.locator('[data-act="sound"]').click();
  await page.locator('[data-lv="l2"]').click();
  for (let step = 1; step <= 2; step++) {
    await page.locator(`.scene[data-step="${step}"]`).waitFor();
    const count = Number(await page.locator('.goal .chip').textContent());
    const source = page.locator('.src');
    if (step === 1) {
      await source.hover();
      const rect = await source.boundingBox();
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await page.mouse.down();
      await page.mouse.move(2, 2, { steps: 8 });
      await page.mouse.up();
      await page.waitForFunction(() => !document.querySelector('.ghost'));
      assert.equal(await page.locator('[data-fig="T"] .nb-b.vazio').count(), count);
    }
    await source.dragTo(page.locator('#ground'));
    await page.waitForFunction(expected => document.querySelectorAll('[data-fig="T"] .nb-b.vazio').length === expected, count - 1);
    for (let i = 1; i < count; i++) await source.click();
    await page.locator('[data-act="next"]').click();
  }
  await page.locator('[data-fig="A"]').dragTo(page.locator('[data-fig="B"]'));
  await page.locator('[data-fig="M"]').waitFor();
  await page.waitForTimeout(1300); // Longest merge animation: 1185 ms.
  const total = await page.locator('[data-fig="M"] .nb-b').count();
  const operands = await page.locator('.eq .chip').allTextContents();
  assert.equal(total, operands.reduce((sum, value) => sum + Number(value), 0));
  for (let i = 0; i < total; i++) await page.locator(`[data-fig="M"] .nb-b[data-i="${i}"]`).click();
  await page.locator('.scene[data-step="4"]').waitFor();
  await page.locator(`.dock .opt:not([data-val="${total}"])`).first().dragTo(page.locator('.ans'));
  await page.locator('.opt.bad:disabled').waitFor();
  await page.locator(`.dock .opt[data-val="${total}"]`).dragTo(page.locator('.ans'));
  await page.locator('[data-act="new"]').waitFor();
  assert.equal(Number(await page.locator('.ans.ok').textContent()), total);
  assert.deepEqual(errors, []);
  await page.close();
  console.log('PASS joining: animated dragging, missed drop, wrong and correct answers');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 667, height: 375 }]) {
      const page = await browser.newPage({ viewport, hasTouch: viewport.width < 800, reducedMotion: 'reduce' });
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${baseURL}/numberblocks-somar/`);
      await page.locator('[data-act="sound"]').click();
      for (const level of ['l1', 'l2', 'l3', 'l4']) {
        await page.locator(`[data-lv="${level}"]`).click();
        await solveRound(page, { keyboard: true, assisted: level === 'l1' });
        await page.locator('[data-act="new"]').click();
        await page.locator('.src').press('Enter');
        await page.locator('#top [data-act="home"]').click();
        // A new round restores the exit warning even after a previous success.
        await page.locator('.confirm').waitFor();
        await page.keyboard.press('Shift+Tab');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.act), 'leave');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.act), 'stay');
        await page.locator('[data-act="stay"]').click();
        // Continue the same new round to catch leaked solved state at merging.
        await solveRound(page, { keyboard: false, assisted: false });
        await page.locator('[data-act="home"]').last().click();
        console.log(`PASS joining: ${level}, ${viewport.width}x${viewport.height}`);
      }
      const stars = await page.locator('.stars b').textContent();
      assert.equal(Number(stars), 8);
      await page.reload();
      assert.equal(await page.locator('.stars b').textContent(), stars);
      await page.locator('[data-lv="l3"]').click();
      await page.locator('.src').press('Enter');
      await page.locator('#top [data-act="home"]').click();
      await page.locator('[data-act="leave"]').press('Enter');
      await page.locator('.lv-grid').waitFor();
      assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
    await animatedDragRound(browser);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
