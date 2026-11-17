(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.DayNightModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const targets = Object.freeze({ day: 0, sunset: Math.PI / 2, night: Math.PI, sunrise: Math.PI * 1.5 });
  function normalize(angle) { return ((angle % TAU) + TAU) % TAU; }
  function getState(angle) {
    const a = normalize(angle);
    const elevation = Math.cos(a);
    const twilight = Math.abs(elevation) < 0.2;
    const phase = twilight ? (a < Math.PI ? 'sunset' : 'sunrise') : elevation > 0 ? 'day' : 'night';
    const t = Math.max(0, Math.min(1, (elevation + 0.16) / 0.65));
    return { angle: a, elevation, phase, daylight: t * t * (3 - 2 * t) };
  }
  return { TAU, targets, normalize, getState };
});
