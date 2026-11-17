(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.DayNightModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const DEGREES = Math.PI / 180;
  // Municipal reference point: 23°01′36″ S, 45°33′20″ W.
  // Programa Municipal de Educação Ambiental, Prefeitura de Taubaté (2019).
  const location = Object.freeze({
    name: 'Taubaté', state: 'SP', country: 'Brasil',
    latitude: -(23 + 1 / 60 + 36 / 3600),
    longitude: -(45 + 33 / 60 + 20 / 3600),
    sourceURL: 'https://www.taubate.sp.gov.br/wp-content/uploads/2019/07/Programa-Municipal-de-Educa%C3%A7%C3%A3o-Ambiental.pdf',
  });
  const targets = Object.freeze({ day: 0, sunset: Math.PI / 2, night: Math.PI, sunrise: Math.PI * 1.5 });
  function normalize(angle) { return ((angle % TAU) + TAU) % TAU; }
  function geographicVector(latitude, longitude, radius = 1) {
    // SphereGeometry r128: u=(longitude+180)/360; the image is flipped in Y.
    const lat = latitude * DEGREES, lon = longitude * DEGREES;
    const horizontalRadius = radius * Math.cos(lat);
    return { x: horizontalRadius * Math.cos(lon), y: radius * Math.sin(lat), z: -horizontalRadius * Math.sin(lon) };
  }
  function earthRotation(angle) {
    // At simulated noon Taubaté faces the fixed Sun on the negative X axis.
    return -Math.PI - location.longitude * DEGREES + angle;
  }
  function getLocalTime(angle) {
    // A teaching clock, not the current civil time or a seasonal ephemeris.
    // One rotation is 24 hours; noon is the starting angle. Round to the minute.
    const minutes = Math.round(normalize(angle) / TAU * 1440 + 720) % 1440;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
  function getState(angle) {
    const a = normalize(angle);
    const elevation = Math.cos(a);
    const twilight = Math.abs(elevation) < 0.2;
    const phase = twilight ? (a < Math.PI ? 'sunset' : 'sunrise') : elevation > 0 ? 'day' : 'night';
    const t = Math.max(0, Math.min(1, (elevation + 0.16) / 0.65));
    return { angle: a, elevation, phase, daylight: t * t * (3 - 2 * t), localTime: getLocalTime(a) };
  }
  return { TAU, targets, location, normalize, geographicVector, earthRotation, getLocalTime, getState };
});
