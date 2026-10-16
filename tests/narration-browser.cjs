/* Optional real MP3 fixture: NARRATION_SAMPLE_PATH=/tmp/sample.mp3 BASE_URL=http://127.0.0.1:8000 node tests/narration-browser.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, webkit } = require('playwright');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const sample = process.env.NARRATION_SAMPLE_PATH;
const intros = [
  ['numberblocks-1-100/blocos-de-somar.html', 'Vamos brincar de somar? Arraste os blocos com calma. Você pode ouvir de novo quando quiser.'],
  ['numberblocks-somar/index.html', 'Vamos juntar os amigos e contar os blocos? Você pode ouvir de novo quando quiser.'],
];
async function verify(engine, name, mobile) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const [url, text] of intros) {
      const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
      const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => requests.push(request.url()));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.route('https://fonts.gstatic.com/**', route => route.abort());
      await page.route('**/assets/narration/manifest.js*', route => route.fulfill({ contentType: 'text/javascript', body: `window.TRIO_NARRATION_MANIFEST=${JSON.stringify({ version: 'fixture', clips: [{ id: 'intro', text, file: 'intro.mp3' }] })};` }));
      await page.route('**/assets/narration/intro.mp3*', route => sample
        ? route.fulfill({ contentType: 'audio/mpeg', body: fs.readFileSync(sample) })
        : route.fulfill({ status: 404 }));
      await page.addInitScript(() => {
        window.__playedMedia = [];
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function (...args) {
          if (!window.__playedMedia.includes(this)) window.__playedMedia.push(this);
          return play.apply(this, args);
        };
      });
      await page.goto(`${baseURL}/${url}`);
      assert.equal(await page.locator('#voice-choice').isDisabled(), true);
      assert.match(await page.locator('#voice-choice').textContent(), /Jessica/);
      assert.equal(requests.filter(url => /\.mp3/.test(url)).length, 0, 'no eager MP3 downloads');
      await page.locator('.voice-settings summary').click();
      await page.locator('[data-act="voice-test"]').click();
      if (sample) {
        await page.waitForFunction(() => TrioNarration.getState().status === 'playing' && __playedMedia.some(media => media.src.includes('intro.mp3') && !media.paused && media.duration > 0));
        assert.equal(await page.evaluate(() => __playedMedia.filter(media => media.src.includes('intro.mp3')).length), 1);
        await page.locator('[data-act="sound"]').click();
        assert.equal(await page.evaluate(() => __playedMedia.every(media => media.paused && !media.getAttribute('src'))), true, 'sound toggle cancels real MP3');
        await page.locator('[data-act="sound"]').click();
      } else {
        await page.waitForFunction(() => TrioNarration.getState().status === 'error');
        assert.match(await page.locator('[data-act="voice-test"]').textContent(), /indisponível/);
      }
      await page.locator('[data-act="level"]').first().click();
      await page.waitForFunction(() => TrioNarration.getState().status === 'error');
      assert.equal(await page.locator('[data-audio-warning]').isVisible(), true, 'missing recording is visible on mobile icon control');
      assert.match(await page.locator('[data-act="repeat"]').getAttribute('aria-label'), /não está disponível/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'status must not overflow the screen');
      assert.equal(requests.some(url => /api\.elevenlabs\.io/.test(url)), false);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS ${name}: ${url}, ${sample ? 'real MP3 decode/play/mute' : 'missing media status'}, visible retry and no eager download`);
    }
  } finally { await browser.close(); }
}
(async () => {
  if (!process.env.BROWSER || process.env.BROWSER === 'chromium') await verify(chromium, 'Chromium', false);
  if (!process.env.BROWSER || process.env.BROWSER === 'webkit') await verify(webkit, 'WebKit', true);
})().catch(error => { console.error(error); process.exitCode = 1; });
