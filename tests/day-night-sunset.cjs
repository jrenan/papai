const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function verifySunset(page, { name, qaDirectory }) {
  const originalViewport = page.viewportSize();
  fs.mkdirSync(qaDirectory, { recursive: true });
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const samples = [];
    for (const degrees of [80, 90, 100, 270]) {
      await page.locator('#rotation').evaluate((input, angle) => {
        input.value = String(angle);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, degrees);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const layout = await page.evaluate(() => {
        const sky = document.querySelector('#skyCanvas').getBoundingClientRect();
        const copy = document.querySelector('#phaseCard').getBoundingClientRect();
        return { skyBottom: sky.bottom, copyTop: copy.top, height: sky.height };
      });
      assert.ok(layout.copyTop >= layout.skyBottom - 1, 'the explanation never covers the sky');
      assert.ok(layout.height >= 180, 'the scene remains tall enough to see the horizon');
      const frame = await page.locator('#skyCanvas').screenshot();
      const pixels = await page.evaluate(async base64 => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const color = document.body.dataset.renderer === '2d'
          ? [255, 232, 161]
          : (() => { const c = new THREE.Color('#ffed9b').convertLinearToSRGB(); return [c.r,c.g,c.b].map(v => Math.round(v * 255)); })();
        let count = 0, bottom = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (color.every((v, channel) => Math.abs(data[i + channel] - v) <= 1)) {
            count++; bottom = Math.max(bottom, Math.floor(i / 4 / canvas.width));
          }
        }
        return { count, bottom, height: canvas.height, horizon: document.body.dataset.renderer === '2d' ? .7 : .447 };
      }, frame.toString('base64'));
      samples.push({ degrees, ...pixels });
      await page.locator('#skyView').screenshot({ path: path.join(qaDirectory, `sunset-${name.toLowerCase().replaceAll(' ', '-')}-${viewport.width}-${degrees}.png`) });
    }
    const [before, horizon, after, sunrise] = samples;
    assert.ok(before.count > 40, `${name}: the Sun is visible before sunset`);
    assert.ok(horizon.count > 10 && horizon.count < before.count * .8, `${name}: the horizon progressively occludes the solar disk: ${JSON.stringify(samples)}`);
    assert.equal(after.count, 0, `${name}: no solar disk remains after sunset`);
    assert.ok(sunrise.count > 10, `${name}: the rising Sun is visible at the opposite side: ${JSON.stringify(samples)}`);
    for (const sample of samples) assert.ok(sample.bottom <= sample.height * sample.horizon + 1, `${name}: no part of the Sun is drawn below the horizon`);
  }
  await page.setViewportSize(originalViewport);
  await page.locator('#rotation').evaluate(input => {
    input.value = '0'; input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  console.log(`PASS ${name} sunrise/sunset: progressive horizon occlusion, no Sun below ground, unobstructed explanation and desktop/mobile layouts`);
}

module.exports = { verifySunset };
