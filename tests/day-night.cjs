const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const modelPath = path.join(__dirname, '../dia-e-noite/astronomy.js');
const { TAU, normalize, getState, targets, location, geographicVector, earthRotation, getLocalTime } = require(modelPath);
const THREE = require('../dia-e-noite/vendor/three.min.js');

function near(actual, expected, message, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, got ${actual}`);
}

near(TAU, Math.PI * 2, 'one turn is two pi');
near(location.latitude, -23.026666666666667, 'Taubaté latitude comes from the municipal reference point');
near(location.longitude, -45.55555555555556, 'Taubaté longitude comes from the municipal reference point');
assert.equal(location.name, 'Taubaté');

// Check the map convention against the actual bundled geometry, not a second
// copy of our conversion formula. Pole UVs have an intentional seam offset.
const sphere = new THREE.SphereGeometry(2, 12, 8);
for (let i = 13; i < sphere.attributes.position.count - 13; i++) {
  const latitude = sphere.attributes.uv.getY(i) * 180 - 90;
  const longitude = sphere.attributes.uv.getX(i) * 360 - 180;
  const position = geographicVector(latitude, longitude, 2);
  for (const axis of ['x', 'y', 'z']) {
    const expected = sphere.attributes.position[`get${axis.toUpperCase()}`](i);
    near(position[axis], expected, `latitude/longitude stays on the texture at vertex ${i} (${axis})`, 1e-6);
  }
}
const base = geographicVector(location.latitude, location.longitude);
const marker = new THREE.Vector3(base.x, base.y, base.z);
const axis = new THREE.Vector3(0, 1, 0);
const equatorialRadius = Math.cos(location.latitude * Math.PI / 180);
for (const [angle, time] of [[0, '12:00'], [Math.PI / 2, '18:00'], [Math.PI, '00:00'], [Math.PI * 1.5, '06:00'], [Math.PI / 12, '13:00'], [-Math.PI / 12, '11:00']]) {
  const world = marker.clone().applyAxisAngle(axis, earthRotation(angle));
  near(-world.x / equatorialRadius, getState(angle).elevation, 'Taubaté illumination follows the same angle as the sky');
  near(world.y, base.y, 'rotating the Earth keeps Taubaté at its southern latitude');
  assert.equal(getLocalTime(angle), time, 'the simulation uses the 24-hour clock');
  assert.equal(getState(angle).localTime, time, 'the visible state and clock agree');
  for (const turns of [-100, -1, 1, 100]) assert.equal(getLocalTime(angle + turns * TAU), time, 'the clock repeats on complete turns');
}
assert.equal(getLocalTime(Math.PI - TAU / 1440), '23:59', 'midnight follows 23:59');
assert.equal(getLocalTime(Math.PI + TAU / 1440), '00:01', 'the clock continues after midnight');
const noon = marker.clone().applyAxisAngle(axis, earthRotation(0));
near(noon.z, 0, 'Taubaté is aligned with the fixed Sun at noon');
assert.ok(noon.x < 0, 'Taubaté faces the illuminated hemisphere at noon');
for (const [name, angle] of Object.entries({ day: 0, sunset: Math.PI / 2, night: Math.PI, sunrise: Math.PI * 1.5 })) {
  near(targets[name], angle, `${name} target`);
  for (const turns of [-100, -3, -1, 0, 1, 3, 100]) {
    const state = getState(angle + turns * TAU);
    assert.equal(state.phase, name, `${name} stays the same after ${turns} full turns`);
    near(state.elevation, Math.cos(angle), `${name} solar elevation`);
    assert.ok(state.daylight >= 0 && state.daylight <= 1, `${name} daylight remains bounded`);
  }
}
near(getState(targets.day).daylight, 1, 'noon has full daylight');
near(getState(targets.night).daylight, 0, 'midnight has no daylight');
for (const angle of [-TAU * 3 - 0.4, -Math.PI, -0.01, 0, 0.1, Math.PI, TAU, TAU * 4.2]) {
  const normalized = normalize(angle);
  assert.ok(normalized >= 0 && normalized < TAU, `normalize(${angle}) is within one turn`);
  near(Math.sin(normalized), Math.sin(angle), 'normalization preserves the position');
  near(Math.cos(normalized), Math.cos(angle), 'normalization preserves illumination');
  near(getState(angle).elevation, Math.cos(angle), 'surface faces the fixed Sun consistently');
}

const phases = [];
let previous = getState(0);
for (let index = 0; index <= 8000; index += 1) {
  const angle = TAU * index / 8000;
  const state = getState(angle);
  assert.ok(Number.isFinite(state.elevation) && Number.isFinite(state.daylight));
  assert.ok(state.elevation >= -1 && state.elevation <= 1);
  assert.ok(state.daylight >= 0 && state.daylight <= 1);
  near(state.elevation, Math.cos(angle), 'continuous solar elevation');
  assert.ok(Math.abs(state.daylight - previous.daylight) < 0.02, 'sky brightness does not jump during a small rotation');
  if (index > 0 && index <= 4000) assert.ok(state.daylight <= previous.daylight + 1e-10, 'noon to midnight darkens continuously');
  if (index > 4000) assert.ok(state.daylight >= previous.daylight - 1e-10, 'midnight to noon brightens continuously');
  if (phases.at(-1) !== state.phase) phases.push(state.phase);
  previous = state;
}
assert.deepEqual(phases, ['day', 'sunset', 'night', 'sunrise', 'day'], 'one forward turn follows the real order of the day');
near(getState(-1e-7).daylight, getState(1e-7).daylight, 'sky brightness stays continuous at a full turn', 1e-6);

// The same browser artifact must expose its model without Node-specific globals.
const browser = { window: {} };
browser.globalThis = browser.window;
vm.runInNewContext(fs.readFileSync(modelPath, 'utf8'), browser, { filename: modelPath });
const browserModel = browser.window.DayNightModel || browser.DayNightModel;
assert.ok(browserModel, 'the model loads as a standalone browser script');
assert.equal(browserModel.getState(Math.PI).phase, 'night');
assert.equal(browserModel.getLocalTime(Math.PI), '00:00');
assert.equal(browserModel.location.name, 'Taubaté');

console.log('PASS day/night model: Taubaté map coordinates, matching texture/illumination, 24-hour clock, fixed Sun, four phases, both drag directions and continuous lighting');
