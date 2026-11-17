/* Orthographic globe texture for the lightweight renderer. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DayNightGlobeMap = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const MAX_LOOKUPS = 3;

  function create(textureCanvas) {
    const textureContext = textureCanvas.getContext('2d');
    if (!textureContext) throw new Error('The globe texture needs a 2D canvas.');
    const lookups = new Map();
    let textureWidth = 0, textureHeight = 0, texturePixels, revision = 0;

    function makeCanvas(width, height) {
      const owner = textureCanvas.ownerDocument || (typeof document !== 'undefined' ? document : null);
      const canvas = owner ? owner.createElement('canvas') : new OffscreenCanvas(width, height);
      canvas.width = width; canvas.height = height;
      return canvas;
    }

    function refresh() {
      const width = textureCanvas.width, height = textureCanvas.height;
      if (!(width > 0 && height > 0)) throw new Error('The globe texture must not be empty.');
      if (width !== textureWidth || height !== textureHeight) lookups.clear();
      textureWidth = width; textureHeight = height;
      const data = textureContext.getImageData(0, 0, width, height).data;
      texturePixels = new Uint32Array(data.buffer, data.byteOffset, data.length / 4);
      revision++;
    }

    function buildLookup(radius) {
      const diameter = Math.ceil(radius * 2), center = diameter / 2;
      const canvas = makeCanvas(diameter, diameter);
      const context = canvas.getContext('2d');
      const image = context.createImageData(diameter, diameter);
      const destinationPixels = new Uint32Array(image.data.buffer);
      const rows = [];
      let count = 0;
      for (let y = 0; y < diameter; y++) {
        const ny = (center - y - .5) / radius;
        if (Math.abs(ny) >= 1) continue;
        const extent = Math.sqrt(1 - ny * ny) * radius;
        const start = Math.max(0, Math.ceil(center - extent - .5));
        const end = Math.min(diameter - 1, Math.floor(center + extent - .5));
        const latitude = Math.asin(ny);
        const textureY = Math.min(textureHeight - 1, Math.max(0, Math.floor((.5 - latitude / Math.PI) * textureHeight)));
        rows.push({ y, ny, start, end, sourceRow: textureY * textureWidth });
        count += Math.max(0, end - start + 1);
      }
      const columns = new Float32Array(count);
      const sourceRows = new Uint32Array(count);
      const destinations = new Uint32Array(count);
      let index = 0;
      for (const row of rows) {
        for (let x = row.start; x <= row.end; x++) {
          const nx = (x + .5 - center) / radius;
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - row.ny * row.ny));
          // The camera sees +Z. SphereGeometry's unrotated front is longitude
          // -90°, and its texture uses u=(longitude+180)/360.
          columns[index] = (Math.atan2(-nz, nx) / TAU + .5) * textureWidth;
          sourceRows[index] = row.sourceRow;
          destinations[index] = row.y * diameter + x;
          index++;
        }
      }
      return { canvas, context, image, destinationPixels, columns, sourceRows, destinations, diameter, lastRotation: null, lastRevision: -1 };
    }

    function paint(context, { cx, cy, r, rotation }) {
      if (![cx, cy, r, rotation].every(Number.isFinite) || r <= 0) throw new RangeError('The globe requires a finite center, positive radius and rotation.');
      const key = `${r}:${textureWidth}:${textureHeight}`;
      let lookup = lookups.get(key);
      if (!lookup) {
        lookup = buildLookup(r);
        if (lookups.size >= MAX_LOOKUPS) lookups.delete(lookups.keys().next().value);
      } else lookups.delete(key);
      lookups.set(key, lookup);
      const turn = ((rotation / TAU) % 1 + 1) % 1;
      if (lookup.lastRotation !== turn || lookup.lastRevision !== revision) {
        const shift = turn * textureWidth;
        const { columns, sourceRows, destinations, destinationPixels } = lookup;
        // Rotation changes only longitude. All square roots and inverse
        // trigonometry are cached above, so a frame is just indexed pixel copies.
        for (let i = 0; i < columns.length; i++) {
          let column = columns[i] - shift;
          if (column < 0) column += textureWidth;
          if (column >= textureWidth) column -= textureWidth;
          destinationPixels[destinations[i]] = texturePixels[sourceRows[i] + (column | 0)];
        }
        lookup.context.putImageData(lookup.image, 0, 0);
        lookup.lastRotation = turn; lookup.lastRevision = revision;
      }
      context.drawImage(lookup.canvas, cx - lookup.diameter / 2, cy - lookup.diameter / 2);
    }

    refresh();
    return { paint, refresh };
  }

  return { create };
});
