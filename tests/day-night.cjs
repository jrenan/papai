const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const modelPath = path.join(__dirname, '../dia-e-noite/astronomy.js');
const { TAU, normalize, getState, targets } = require(modelPath);

function near(actual, expected, message, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, got ${actual}`);
}

near(TAU, Math.PI * 2, 'one turn is two pi');
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

console.log('PASS day/night model: fixed Sun, four phases, forward order, both drag directions, repeated turns and continuous lighting');
