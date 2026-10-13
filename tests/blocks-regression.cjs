/* Run with a local static server, e.g. BASE_URL=http://127.0.0.1:8000 node tests/blocks-regression.cjs. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const source = fs.readFileSync(path.join(__dirname, '../numberblocks-1-100/blocos-de-somar.html'), 'utf8');
// Expose state only in the browser response used by this test; production stays private.
const html = source.replace(/\n\}\)\(\);\s*<\/script>/, `
window.__blocksTest = { S, mk, emptyZ, hintTarget, render, doEnter };
})();
</script>`);

async function scenario(browser, mobile) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    isMobile: mobile, hasTouch: mobile, reducedMotion: mobile ? 'no-preference' : 'reduce',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/blocos-de-somar.html', route => route.fulfill({ contentType: 'text/html', body: html }));
  const ready = () => page.waitForFunction(() => {
    const { S } = window.__blocksTest;
    return !S.busy && !S.grouping;
  });
  const activate = async selector => {
    await ready();
    if (mobile) await page.locator(selector).first().tap();
    else await page.locator(selector).first().press('Enter');
    await ready();
  };
  const setProblem = async (a, b) => {
    await page.evaluate(({ a, b }) => {
      const { S, emptyZ, doEnter } = window.__blocksTest;
      Object.assign(S, { a, b, screen: 'game', level: 'l3', busy: false, grouping: false, solved: false });
      S.pid++;
      S.Z = { M: emptyZ(), A: emptyZ(), B: emptyZ() };
      doEnter(1, true);
    }, { a, b });
  };
  await page.goto(`${baseURL}/numberblocks-1-100/blocos-de-somar.html`);
  await setProblem(23, 14);
  await page.evaluate(() => {
    const { S, mk, render } = window.__blocksTest;
    S.Z.M.ones = Array.from({ length: 9 }, () => mk('one', ['a']));
    render();
  });
  assert.equal(await page.evaluate(() => window.__blocksTest.hintTarget().to.dataset.act), 'undo', 'help must remove excess units before suggesting tens');

  await activate('[data-act="home"]');
  assert.equal(await page.locator('[data-act="stay"]').evaluate(el => document.activeElement === el), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator('[data-act="leave"]').evaluate(el => document.activeElement === el), true, 'reverse Tab must stay in the exit dialog');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('[data-act="stay"]').evaluate(el => document.activeElement === el), true, 'Tab must wrap inside the exit dialog');
  assert.equal(await page.locator('#app').evaluate(el => el.inert), true, 'game controls must be inert while confirming exit');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.confirm').count(), 0);
  assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
  assert.equal(await page.evaluate(() => window.__blocksTest.S.Z.M.ones.length), 9);

  await setProblem(27, 15);
  for (const n of [27, 15]) {
    for (let i = 0; i < Math.floor(n / 10); i++) await activate('[data-drag="src-ten"]');
    for (let i = 0; i < n % 10; i++) await activate('[data-drag="src-one"]');
    await activate('[data-act="check"]');
    await activate('[data-act="next-step"]');
  }
  assert.equal(await page.evaluate(() => window.__blocksTest.S.step), 3);
  await activate('[data-drop="A"] [data-drag="piece"]:first-of-type');
  await activate('[data-drop="A"] [data-drag="piece"]:first-of-type');
  await activate('[data-act="join-rest"]');
  const combined = await page.evaluate(() => {
    const { S } = window.__blocksTest;
    return [S.Z.A.tens.length, S.Z.A.ones.length, S.Z.B.tens.length, S.Z.B.ones.length];
  });
  assert.deepEqual(combined, [0, 0, 3, 12], 'join the rest must preserve all pieces and leave regrouping for the child');
  await activate('[data-drag="col"]');
  await page.waitForFunction(() => window.__blocksTest.S.countShown && !window.__blocksTest.S.busy);
  await activate('[data-act="ans"][data-k="t"][data-n="4"]');
  await activate('[data-act="ans"][data-k="u"][data-n="2"]');
  assert.equal(await page.evaluate(() => window.__blocksTest.hintTarget().to.dataset.act), 'to4', 'help must advance once both place values have been answered');
  await activate('[data-act="to4"]');
  await activate('[data-drag="opt"]:not([data-val="42"])');
  assert.equal(await page.locator('.opt.bad').count(), 1, 'wrong tap or keyboard answer must be rejected');
  await activate('[data-drag="opt"][data-val="42"]');
  assert.equal(await page.evaluate(() => window.__blocksTest.S.solved), true);
  assert.equal(await page.evaluate(() => localStorage.getItem('triodosaber.blocos.estrelas.v1')), '1');
  await page.reload();
  assert.equal(await page.locator('.stars b').textContent(), '1', 'earned stars must survive reload');

  await setProblem(27, 15);
  await activate('[data-drag="src-one"]');
  await activate('[data-act="home"]');
  await activate('[data-act="leave"]');
  assert.equal(await page.evaluate(() => window.__blocksTest.S.screen), 'home');
  assert.equal(await page.locator('.confirm').count(), 0);
  assert.equal(await page.locator('#app').evaluate(el => el.inert), false);
  if (!mobile) {
    const dimensions = await page.evaluate(async () => Promise.all(Array.from({ length: 100 }, async (_, i) => {
      const image = new Image();
      image.src = `${String(i + 1).padStart(3, '0')}.webp`;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    })));
    assert.equal(dimensions.length, 100);
    assert.equal(dimensions.every(([width, height]) => width > 0 && height > 0), true, 'all 100 WebP assets must load and decode');
  }
  assert.deepEqual(errors, [], 'there must be no JavaScript runtime errors');
  console.log(`PASS blocks: ${mobile ? 'mobile touch with animation' : 'desktop keyboard, reduced motion'}`);
  await context.close();
}

(async () => {
  const browserName = process.env.BROWSER || 'chromium';
  const engine = { chromium, webkit }[browserName];
  assert.ok(engine, 'BROWSER must be chromium or webkit');
  const browser = await engine.launch({ executablePath: browserName === 'chromium' ? process.env.CHROMIUM_PATH || undefined : undefined });
  try { await scenario(browser, false); await scenario(browser, true); }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
