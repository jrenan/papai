const assert = require('node:assert/strict');
const { create } = require('../dia-e-noite/globe-map.js');
const model = require('../dia-e-noite/astronomy.js');
const THREE = require('../dia-e-noite/vendor/three.min.js');

// Minimal Canvas contract, so the pixel mapping can be checked without a
// browser, native graphics dependency or a screenshot baseline.
class Canvas {
  constructor(width = 1, height = 1) {
    this.width = width; this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
    this.ownerDocument = { createElement: () => new Canvas() };
    this.context = {
      getImageData: () => ({ data: this.data.slice() }),
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: image => { this.data = image.data.slice(); },
    };
  }
  getContext() { return this.context; }
}

const texture = new Canvas(360, 180);
for (let y = 0; y < 180; y++) for (let x = 0; x < 360; x++) {
  const offset = (y * 360 + x) * 4;
  // Encode longitude-column and latitude-row in RGB.
  texture.data.set([x % 256, Math.floor(x / 256), y, 255], offset);
}
const globe = create(texture);
let frame, origin;
const context = { drawImage: (canvas, x, y) => { frame = canvas; origin = { x, y }; } };
const draw = (rotation, r = 160) => globe.paint(context, { cx: 200, cy: 180, r, rotation });
const pixel = (x, y) => Array.from(frame.data.slice((y * frame.width + x) * 4, (y * frame.width + x) * 4 + 4));
const decode = rgba => ({ longitude: rgba[0] + rgba[1] * 256 - 179.5, latitude: 89.5 - rgba[2], alpha: rgba[3] });

draw(0);
assert.ok(Math.abs(decode(pixel(160, 160)).longitude + 90) <= .5, 'the front of the unrotated Three.js sphere is longitude -90°');
assert.equal(pixel(0, 0)[3], 0, 'pixels outside the sphere stay transparent');
assert.equal(pixel(160, 160)[3], 255, 'the sphere center is opaque');
assert.deepEqual(origin, { x: 40, y: 20 }, 'painting centers the globe at the requested canvas coordinates');
const firstFrame = frame.data.slice();
draw(model.TAU);
assert.deepEqual(frame.data, firstFrame, 'a complete turn reproduces the same map');

const home = model.geographicVector(model.location.latitude, model.location.longitude);
const marker = new THREE.Vector3(home.x, home.y, home.z);
const axis = new THREE.Vector3(0, 1, 0);
for (const angle of [Math.PI / 6, Math.PI / 2, Math.PI * 5 / 6]) {
  const rotation = model.earthRotation(angle);
  draw(rotation);
  const world = marker.clone().applyAxisAngle(axis, rotation);
  const sample = decode(pixel(Math.floor(160 + world.x * 160), Math.floor(160 - world.y * 160)));
  assert.ok(Math.abs(sample.longitude - model.location.longitude) <= 1, 'Taubaté marker remains on its longitude as the sphere rotates');
  assert.ok(Math.abs(sample.latitude - model.location.latitude) <= 1, 'Taubaté marker remains on its southern latitude');
  assert.equal(sample.alpha, 255);
}

const trig = { atan2: Math.atan2, asin: Math.asin, sqrt: Math.sqrt };
try {
  for (const name of Object.keys(trig)) Math[name] = () => { throw new Error('Per-frame geometry lookup should be cached.'); };
  draw(.7);
  draw(1.1);
} finally { Object.assign(Math, trig); }

texture.data.fill(255);
draw(1.1);
assert.notDeepEqual(pixel(160, 160), [255, 255, 255, 255], 'texture changes do not bypass the cached snapshot');
globe.refresh();
draw(1.1);
assert.deepEqual(pixel(160, 160), [255, 255, 255, 255], 'refresh updates map pixels even at the same rotation');
assert.equal(pixel(0, 0)[3], 0, 'refresh preserves transparency outside the globe');
draw(1.1, 100.25);
assert.equal(frame.width, 201, 'fractional physical-pixel radii are supported');
assert.equal(pixel(0, 0)[3], 0);
assert.throws(() => draw(0, 0), RangeError);

console.log('PASS globe map: Three.js UV orientation, Taubaté marker alignment, rotation, transparent boundary, cached trigonometry and texture refresh');
