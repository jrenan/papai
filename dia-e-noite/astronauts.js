/* Leo and Rafa: reusable, fully three-dimensional toy astronauts.
 * Likeness comes from the family photos: Leo has short brown hair with a
 * straight forward fringe, warm brown smiling eyes, round rosy cheeks and a
 * wide gap-toothed grin. Rafa has longer golden-brown hair swept to one side,
 * big grey-blue eyes, defined eyebrows and a gentle smile.
 * Model faces +Z; approximately 2.9 units tall, with the chest near the origin.
 * Shading is baked into small matcap textures, so the models need no lights.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrioAstronauts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2, DEG = Math.PI / 180;

  const LOOKS = {
    blue: { // Leo
      accent: '#3f9cf0', accentDark: '#1d5c9a', glow: '#a5e0ff',
      skin: '#f9d4b8', shade: '#d6957a', blush: '#f27a82', blushAlpha: .5, lip: '#d6706c',
      hair: ['#5c3618', '#6f431f', '#86562b'], brow: '#8a5f38', lash: '#3d2717',
      iris: ['#3b200d', '#7c4921', '#b47a38'],
      head: [.452, .462, .412], jaw: .04, cheeks: .05, chin: 0,
      eye: { x: .18, y: -.012, r: .185, out: .031, tilt: 4, upper: 32.5, lower: 38, iris: .372 },
      brow3d: { w: .015, pts: [[10.5, 20.5], [23, 23.5], [37, 19.5]] },
      nose: { pitch: -14, scale: [.058, .045, .048] },
      ear: { scale: [.058, .098, .045], flare: .3 },
      cheek: [29, -15, 14],
      cap: { length: 92, tilt: 44 },
      mouth: { smile: { half: 18, pitch: -29, sag: 3.6, open: 10.5, teeth: 3.6, gap: 7 },
               laugh: { half: 20, pitch: -28.5, sag: 3.6, open: 14, teeth: 3.8, gap: 7.5 } },
    },
    red: { // Rafa
      accent: '#f0584a', accentDark: '#a02e28', glow: '#ffc2b3',
      skin: '#f8d2b3', shade: '#d39274', blush: '#f08a86', blushAlpha: .36, lip: '#d47a72',
      hair: ['#6b431f', '#84582a', '#a07038'], brow: '#7a5330', lash: '#3a2515',
      iris: ['#2f4a60', '#6c93ad', '#b3cfdb'],
      head: [.432, .478, .402], jaw: .13, cheeks: .02, chin: .022,
      eye: { x: .177, y: -.005, r: .195, out: .032, tilt: 1.5, upper: 31, lower: 38, iris: .374 },
      brow3d: { w: .017, pts: [[9.5, 21.5], [22.5, 25], [37, 20.5]] },
      nose: { pitch: -13.5, scale: [.052, .05, .054] },
      ear: { scale: [.066, .118, .05], flare: .46 },
      cheek: [28, -16, 12.5],
      cap: { length: 93, tilt: 43 },
      mouth: { smile: { half: 13, pitch: -30, sag: 2.8, open: 6, teeth: 2.8, gap: 0 },
               laugh: { half: 17, pitch: -29.5, sag: 3.2, open: 11, teeth: 3.4, gap: 0 } },
    },
  };

  // ---- Colour helpers -----------------------------------------------------
  function hexRGB(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  const toLinear = c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
  const hexLinear = hex => hexRGB(hex).map(toLinear);
  const SRGB8 = new Uint8Array(1025);
  for (let i = 0; i <= 1024; i++) {
    const c = i / 1024;
    SRGB8[i] = Math.round(255 * (c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - .055));
  }
  const encode = v => SRGB8[Math.max(0, Math.min(1024, Math.round(v * 1024)))];
  const rgba = (hex, alpha) => { const [r, g, b] = hexRGB(hex); return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`; };
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  function pixelTexture(T, size, paint) {
    const data = new Uint8ClampedArray(size * size * 4);
    paint(data);
    let texture;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      const image = context.createImageData(size, size);
      image.data.set(data); context.putImageData(image, 0, 0);
      texture = new T.CanvasTexture(canvas);
    } else {
      const flipped = new Uint8Array(data.length), row = size * 4;
      for (let y = 0; y < size; y++) flipped.set(data.subarray(y * row, y * row + row), (size - 1 - y) * row);
      texture = new T.DataTexture(flipped, size, size, T.RGBAFormat);
      texture.magFilter = texture.minFilter = T.LinearFilter; texture.needsUpdate = true;
    }
    texture.encoding = T.sRGBEncoding;
    return texture;
  }

  // ---- Baked studio lighting ---------------------------------------------
  // A warm key from the upper left, a cool fill and a soft rim. Baking the
  // colour into each matcap keeps highlights white instead of tinted.
  const KEY = normalize([-.5, .62, .6]), FILL = normalize([.7, -.15, .7]);
  const HALF = normalize([KEY[0], KEY[1], KEY[2] + 1]);
  function normalize(v) { const l = Math.hypot(...v); return v.map(x => x / l); }
  const STYLES = {
    cloth: { wrap: .6, key: .56, fill: .1, sky: [.44, .45, .5], ground: [.37, .37, .47], spec: .05, shine: 9, rim: .24, rimColor: [.8, .92, 1] },
    gloss: { wrap: .35, key: .6, fill: .1, sky: [.4, .42, .47], ground: [.3, .3, .4], spec: .75, shine: 60, sheen: .1, rim: .4, rimColor: [.82, .94, 1] },
    skin: { wrap: .8, key: .5, fill: .08, sky: [.5, .49, .49], ground: [.5, .37, .35], spec: .07, shine: 22, rim: .14, rimColor: [1, .95, .88] },
    hair: { wrap: .5, key: .66, fill: .08, sky: [.42, .41, .42], ground: [.3, .26, .27], spec: .07, shine: 10, rim: .12, rimColor: [1, .85, .62] },
    eye: { wrap: 1, key: .22, fill: .04, sky: [.8, .8, .81], ground: [.68, .69, .74], spec: 0, shine: 1, rim: 0, rimColor: [1, 1, 1] },
  };
  const matcapCache = new Map();
  function matcap(T, hex, styleName, size) {
    const id = `${size}|${styleName}|${hex}`;
    if (matcapCache.has(id)) return matcapCache.get(id);
    const style = STYLES[styleName], base = hexLinear(hex);
    const texture = pixelTexture(T, size, data => {
      let o = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++, o += 4) {
        let nx = (x + .5) / size * 2 - 1, ny = 1 - (y + .5) / size * 2;
        const r2 = nx * nx + ny * ny;
        if (r2 > .998) { const k = Math.sqrt(.998 / r2); nx *= k; ny *= k; }
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const diffuse = Math.max(0, (nx * KEY[0] + ny * KEY[1] + nz * KEY[2] + style.wrap) / (1 + style.wrap));
        const fill = Math.max(0, nx * FILL[0] + ny * FILL[1] + nz * FILL[2]);
        const up = ny * .5 + .5;
        const glint = Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]);
        const spec = Math.pow(glint, style.shine) * style.spec + (style.sheen ? Math.pow(glint, 6) * style.sheen : 0);
        const rim = Math.pow(1 - nz, 2.6) * style.rim * smooth(-.4, .9, nx * .75 + ny * .55);
        for (let c = 0; c < 3; c++) {
          const light = style.key * diffuse + style.fill * fill + mix(style.ground[c], style.sky[c], up);
          data[o + c] = encode(base[c] * light + spec + rim * style.rimColor[c]);
        }
        data[o + 3] = 255;
      }
    });
    matcapCache.set(id, texture);
    return texture;
  }
  function glassMatcap(T, size) {
    const id = `${size}|glass`;
    if (matcapCache.has(id)) return matcapCache.get(id);
    const turn = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
    const texture = pixelTexture(T, size, data => {
      let o = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++, o += 4) {
        const nx = (x + .5) / size * 2 - 1, ny = 1 - (y + .5) / size * 2;
        const radius = Math.min(1, Math.hypot(nx, ny)), nz = Math.sqrt(1 - radius * radius);
        const angle = Math.atan2(ny, nx) / DEG;
        const rim = Math.pow(1 - nz, 2.2) * .5;
        const streak = Math.exp(-Math.pow((radius - .74) / .075, 2) - Math.pow(turn(angle, 130) / 24, 2)) * .62
          + Math.exp(-Math.pow((radius - .6) / .04, 2) - Math.pow(turn(angle, 118) / 9, 2)) * .3
          + Math.exp(-Math.pow((radius - .82) / .045, 2) - Math.pow(turn(angle, -48) / 15, 2)) * .22;
        data[o] = encode(rim * .62 + streak); data[o + 1] = encode(rim * .84 + streak); data[o + 2] = encode(rim + streak);
        data[o + 3] = 255;
      }
    });
    matcapCache.set(id, texture);
    return texture;
  }

  function create(T, options = {}) {
    const red = options.variant === 'red';
    const look = LOOKS[red ? 'red' : 'blue'];
    const name = String(options.name || (red ? 'Rafa' : 'Leo'));
    const detail = options.detail === 'low' ? 96 : 192;
    const canDraw = typeof document !== 'undefined';
    const astronaut = new T.Group();
    astronaut.name = `astronaut-${name.toLowerCase()}`;
    astronaut.userData = { name, variant: red ? 'red' : 'blue', kind: 'trio-astronaut' };
    const pose = new T.Group(); pose.name = 'pose'; astronaut.add(pose);

    const toy = (hex, style = 'cloth', extra) => new T.MeshMatcapMaterial({ matcap: matcap(T, hex, style, detail), ...extra });
    const flat = (hex, extra) => new T.MeshBasicMaterial({ color: new T.Color(hex).convertSRGBToLinear(), ...extra });
    const skinLight = matcap(T, '#ffffff', 'skin', detail);
    const materials = {
      suit: toy('#f6f8f4'), suitShade: toy('#cfdbe8'), metal: toy('#b9c7d6', 'gloss'), shell: toy('#fbfcf8', 'gloss'),
      accent: toy(look.accent, 'gloss'), accentSoft: toy(look.accent), dark: toy(look.accentDark, 'gloss'),
      skin: new T.MeshMatcapMaterial({ matcap: skinLight, color: new T.Color(look.skin).convertSRGBToLinear() }),
      ear: toy(look.shade, 'skin'),
      hair: look.hair.map(hex => toy(hex, 'hair', { side: T.DoubleSide })),
      brow: toy(look.brow, 'hair', { side: T.DoubleSide }),
      eye: toy('#ffffff', 'eye'), lash: flat(look.lash), light: flat('#ffffff'),
      gold: toy('#ffd15c', 'gloss'), lamp: flat(look.glow),
    };
    const sphere = new T.SphereGeometry(1, 24, 16);
    function mesh(geometry, material, position, scale, parent = pose) {
      const part = new T.Mesh(geometry, material);
      if (position) part.position.set(...position);
      if (scale) part.scale.set(...scale);
      parent.add(part);
      return part;
    }
    const ellipsoid = (material, position, scale, parent) => mesh(sphere, material, position, scale, parent);
    function ring(radius, thickness, material, position, scale, parent) {
      const part = mesh(new T.TorusGeometry(radius, thickness, 8, 28), material, position, scale, parent);
      part.rotation.x = Math.PI / 2;
      return part;
    }
    // A rounded limb segment hanging from its joint: radius r0 at y=0, r1 at y=-length.
    function capsule(r0, r1, length) {
      const points = [];
      for (let i = 0; i <= 8; i++) { const a = (i / 8 - 1) * Math.PI / 2; points.push(new T.Vector2(Math.cos(a) * r1, -length + Math.sin(a) * r1)); }
      for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; points.push(new T.Vector2(Math.cos(a) * r0, Math.sin(a) * r0)); }
      return new T.LatheGeometry(points, 16);
    }
    function roundedBox(width, height, depth, radius) {
      const w = width / 2 - radius, h = height / 2 - radius, shape = new T.Shape();
      shape.absarc(w, h, radius, 0, Math.PI / 2); shape.absarc(-w, h, radius, Math.PI / 2, Math.PI);
      shape.absarc(-w, -h, radius, Math.PI, Math.PI * 1.5); shape.absarc(w, -h, radius, Math.PI * 1.5, TAU);
      const bevel = Math.min(radius, depth * .4);
      const geometry = new T.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, curveSegments: 8 });
      geometry.translate(0, 0, -depth / 2 + bevel);
      return geometry;
    }

    // ---- Suit -------------------------------------------------------------
    const backpack = mesh(roundedBox(.56, .64, .24, .1), materials.suitShade, [0, .04, -.3]);
    for (const x of [-.15, .15]) {
      mesh(capsule(.075, .075, .3), materials.metal, [x, .2, -.44]);
      ring(.078, .018, materials.accent, [x, .0, -.44]);
    }
    ellipsoid(materials.lamp, [0, .27, -.425], [.035, .035, .02]);
    backpack.name = 'backpack';
    const torso = mesh(new T.LatheGeometry([[0, -.5], [.17, -.5], [.3, -.44], [.37, -.3], [.395, -.1], [.4, .08], [.375, .25], [.31, .39], [.22, .46], [0, .48]].map(p => new T.Vector2(...p)), 24), materials.suit);
    torso.scale.z = .7;
    ellipsoid(materials.accent, [0, .31, .02], [.355, .15, .25]);
    ring(.325, .05, materials.accent, [0, -.33, 0], [1, .72, 1]);
    ellipsoid(materials.gold, [0, -.33, .245], [.055, .05, .03]);
    ring(.25, .07, materials.metal, [0, .49, .01]);
    ring(.262, .022, materials.accent, [0, .435, .01]);

    // Chest console with the sewn name patch; the lamp pulses in animate().
    const chest = new T.Group(); chest.position.set(0, .015, .265); chest.rotation.x = -.06; pose.add(chest);
    mesh(roundedBox(.4, .31, .08, .07), materials.suitShade, null, null, chest);
    if (canDraw) {
      const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 144;
      const c = canvas.getContext('2d');
      c.fillStyle = '#fbfcf7'; c.fillRect(0, 0, 384, 144);
      c.fillStyle = look.accentDark; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '900 92px "Arial Rounded MT Bold","Trebuchet MS",sans-serif';
      c.fillText(name.toUpperCase(), 192, 76, 340);
      const texture = new T.CanvasTexture(canvas); texture.encoding = T.sRGBEncoding;
      texture.anisotropy = 4;
      mesh(roundedBox(.33, .13, .02, .03), materials.shell, [0, .068, .04], null, chest);
      mesh(new T.PlaneGeometry(.3, .112), new T.MeshBasicMaterial({ map: texture }), [0, .068, .0515], null, chest);
    }
    ellipsoid(materials.accent, [-.115, -.075, .042], [.036, .036, .02], chest);
    ellipsoid(materials.gold, [0, -.075, .042], [.036, .036, .02], chest);
    const lamp = ellipsoid(materials.lamp, [.115, -.075, .042], [.036, .036, .02], chest);

    const joints = {};
    function arm(side) {
      const joint = new T.Group(); joint.position.set(side * .4, .3, 0);
      joint.name = side < 0 ? 'left-shoulder' : 'right-shoulder'; pose.add(joint);
      ellipsoid(materials.accent, [0, -.02, 0], [.17, .17, .17], joint);
      mesh(capsule(.125, .118, .22), materials.suit, [0, -.1, 0], null, joint);
      const elbow = new T.Group(); elbow.position.set(0, -.38, 0); joint.add(elbow);
      ring(.112, .034, materials.metal, [0, .01, 0], null, elbow);
      mesh(capsule(.116, .108, .17), materials.suit, [0, -.03, 0], null, elbow);
      ring(.104, .036, materials.accent, [0, -.225, 0], null, elbow);
      ellipsoid(materials.accent, [0, -.345, .012], [.118, .132, .1], elbow);
      ellipsoid(materials.accent, [side * .1, -.3, .06], [.05, .078, .05], elbow).rotation.z = side * -.5;
      joints[side < 0 ? 'leftArm' : 'rightArm'] = joint;
      joints[side < 0 ? 'leftElbow' : 'rightElbow'] = elbow;
    }
    arm(-1); arm(1);
    function leg(side) {
      const joint = new T.Group(); joint.position.set(side * .185, -.38, 0);
      joint.name = side < 0 ? 'left-hip' : 'right-hip'; pose.add(joint);
      mesh(capsule(.165, .148, .24), materials.suit, [0, -.03, 0], null, joint);
      ellipsoid(materials.accent, [0, -.37, .1], [.115, .095, .07], joint);
      mesh(capsule(.148, .14, .17), materials.suit, [0, -.38, .005], null, joint);
      ring(.142, .036, materials.accent, [0, -.6, .01], null, joint);
      ellipsoid(materials.shell, [0, -.74, .07], [.165, .15, .235], joint);
      ellipsoid(materials.dark, [0, -.835, .075], [.175, .06, .25], joint);
      joints[side < 0 ? 'leftLeg' : 'rightLeg'] = joint;
    }
    leg(-1); leg(1);

    // ---- Head -------------------------------------------------------------
    const head = new T.Group(); head.position.set(0, .985, .05); head.scale.setScalar(1.07); head.name = 'head'; pose.add(head);
    joints.head = head;
    const [hx, hy, hz] = look.head;
    // A point on the skull from face angles in degrees; +yaw is the model's left (viewer's right).
    function onHead(yaw, pitch, lift = 0) {
      const flat = Math.cos(pitch * DEG);
      const d = [Math.sin(yaw * DEG) * flat, Math.sin(pitch * DEG), Math.cos(yaw * DEG) * flat];
      return new T.Vector3(d[0] * (hx + lift), d[1] * (hy + lift), d[2] * (hz + lift));
    }

    // The skull keeps a sphere's texture coordinates while the jaw and cheeks are sculpted.
    const skull = new T.SphereGeometry(1, 44, 30);
    {
      const p = skull.attributes.position, v = new T.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const low = Math.max(0, -v.y);
        let widen = 1 - look.jaw * Math.pow(low, 1.6);
        for (const side of [-1, 1]) {
          const dx = v.x - side * .56, dy = v.y + .38, dz = v.z - .72;
          widen += look.cheeks * Math.exp(-(dx * dx + dy * dy + dz * dz) / .1);
        }
        const chin = look.chin * Math.exp(-(v.x * v.x + Math.pow(v.y + .93, 2) + Math.pow(v.z - .32, 2)) / .12);
        p.setXYZ(i, v.x * widen * hx, (v.y - chin * 3) * hy, (v.z * (1 + (widen - 1) * .6) + chin) * hz);
      }
      skull.computeVertexNormals();
      const n = skull.attributes.normal, a = new T.Vector3(), b = new T.Vector3();
      for (let row = 0; row <= 30; row++) { // close the texture seam
        const first = row * 45, last = first + 44;
        a.fromBufferAttribute(n, first); b.fromBufferAttribute(n, last); a.add(b).normalize();
        n.setXYZ(first, a.x, a.y, a.z); n.setXYZ(last, a.x, a.y, a.z);
      }
    }

    // Soft colour only: blush, gentle form shadows and the mouth. Features are volumes.
    const faces = {};
    function face(expression) {
      if (faces[expression] || !canDraw) return faces[expression] || null;
      const size = detail === 96 ? 256 : 512, k = size / 180;
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const g = canvas.getContext('2d');
      const X = yaw => (yaw + 90) * k, Y = pitch => (90 - pitch) * k;
      g.fillStyle = look.skin; g.fillRect(0, 0, size, size);
      function glow(yaw, pitch, radius, hex, alpha, squash = 1) {
        g.save(); g.translate(X(yaw), Y(pitch)); g.scale(1, squash);
        const gradient = g.createRadialGradient(0, 0, 0, 0, 0, radius * k);
        gradient.addColorStop(0, rgba(hex, alpha)); gradient.addColorStop(.5, rgba(hex, alpha * .55)); gradient.addColorStop(1, rgba(hex, 0));
        g.fillStyle = gradient; g.beginPath(); g.arc(0, 0, radius * k, 0, TAU); g.fill(); g.restore();
      }
      const fringe = g.createLinearGradient(0, Y(56), 0, Y(22));
      fringe.addColorStop(0, rgba(look.shade, .42)); fringe.addColorStop(1, rgba(look.shade, 0));
      g.fillStyle = fringe; g.fillRect(0, 0, size, Y(22));
      const jaw = g.createLinearGradient(0, Y(-44), 0, Y(-78));
      jaw.addColorStop(0, rgba(look.shade, 0)); jaw.addColorStop(1, rgba(look.shade, .34));
      g.fillStyle = jaw; g.fillRect(0, Y(-44), size, size);
      const eyeYaw = Math.asin(look.eye.x / hx) / DEG;
      for (const side of [-1, 1]) {
        glow(side * eyeYaw, 1, 19, look.shade, .12);
        glow(side * look.cheek[0], look.cheek[1], look.cheek[2], look.blush, look.blushAlpha, .82);
      }
      glow(0, look.nose.pitch - 6, 6.5, look.shade, .3, .55);

      const m = look.mouth[expression] || look.mouth.smile;
      const cx = X(0), y0 = Y(m.pitch), path = new Path2D(), top = new Path2D();
      if (expression === 'wow') {
        path.ellipse(cx, Y(m.pitch - 4.5), 6.4 * k, 7.6 * k, 0, 0, TAU);
        g.fillStyle = '#641f1d'; g.fill(path);
        g.save(); g.clip(path);
        g.fillStyle = '#f08c8c'; g.beginPath(); g.ellipse(cx, Y(m.pitch - 11.5), 5 * k, 3.4 * k, 0, 0, TAU); g.fill();
        g.fillStyle = '#fffdf6'; g.beginPath(); g.ellipse(cx, Y(m.pitch + 3.6), 4.6 * k, 2.3 * k, 0, 0, TAU); g.fill();
        g.restore();
      } else {
        const x0 = X(-m.half), x1 = X(m.half), inset = m.half * .3 * k, deep = y0 + (m.sag + m.open) / .75 * k;
        top.moveTo(x0, y0); top.quadraticCurveTo(cx, y0 + 2 * m.sag * k, x1, y0);
        path.moveTo(x0, y0); path.quadraticCurveTo(cx, y0 + 2 * m.sag * k, x1, y0);
        path.bezierCurveTo(x1 - inset, deep, x0 + inset, deep, x0, y0); path.closePath();
        g.fillStyle = '#641f1d'; g.fill(path);
        g.save(); g.clip(path);
        g.fillStyle = '#f08c8c'; g.beginPath(); g.ellipse(cx, y0 + (m.sag + m.open * 1.05) * k, m.half * .58 * k, m.open * .5 * k, 0, 0, TAU); g.fill();
        g.strokeStyle = '#fffdf6'; g.lineWidth = m.teeth * 2 * k; g.stroke(top);
        if (m.gap) { // the missing front teeth of a six-year-old
          g.fillStyle = '#641f1d'; g.beginPath();
          g.ellipse(cx, y0 + m.sag * k, m.gap * .5 * k, m.teeth * 1.5 * k, 0, 0, TAU); g.fill();
        }
        g.restore();
        for (const side of [-1, 1]) glow(side * (m.half + 2), m.pitch + .6, 3.2, look.shade, .3);
      }
      g.strokeStyle = look.lip; g.lineWidth = 1.25 * k; g.lineJoin = g.lineCap = 'round'; g.stroke(path);
      glow(0, m.pitch - m.sag - m.open - 6.5, 7, look.shade, .2, .5);

      const texture = new T.CanvasTexture(canvas); texture.encoding = T.sRGBEncoding;
      texture.repeat.set(2, 1); texture.anisotropy = 4;
      return (faces[expression] = texture);
    }
    const faceMaterial = canDraw ? new T.MeshMatcapMaterial({ matcap: skinLight, map: face('smile') }) : materials.skin;
    mesh(skull, faceMaterial, null, null, head);

    for (const side of [-1, 1]) {
      const ear = new T.Group(); ear.position.set(side * (hx - .012), -.03, .0); ear.rotation.y = side * look.ear.flare; head.add(ear);
      ellipsoid(materials.skin, [side * .03, 0, 0], look.ear.scale, ear);
      ellipsoid(materials.ear, [side * .04, -.004, .03], [look.ear.scale[0] * .5, look.ear.scale[1] * .62, look.ear.scale[2] * .5], ear);
    }
    const nose = onHead(0, look.nose.pitch, -.012);
    ellipsoid(materials.skin, [nose.x, nose.y, nose.z], look.nose.scale, head);

    // Eyes are embedded spheres; two skin domes act as lids so the pair can blink and smile.
    const eyes = [];
    const irisTexture = canDraw ? (() => {
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
      const c = canvas.getContext('2d'), gradient = c.createLinearGradient(0, 0, 0, 128);
      gradient.addColorStop(0, '#120b08'); gradient.addColorStop(.33, '#120b08'); gradient.addColorStop(.4, look.iris[2]);
      gradient.addColorStop(.72, look.iris[1]); gradient.addColorStop(.9, look.iris[0]); gradient.addColorStop(1, look.iris[0]);
      c.fillStyle = gradient; c.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 46; i++) { // fine radial fibres
        const x = (i * 53 + 7) % 128;
        c.fillStyle = i % 3 ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.12)';
        c.fillRect(x, 50, 1 + i % 2, 62);
      }
      const texture = new T.CanvasTexture(canvas); texture.encoding = T.sRGBEncoding; texture.wrapS = T.RepeatWrapping;
      return texture;
    })() : null;
    const irisMaterial = irisTexture ? new T.MeshBasicMaterial({ map: irisTexture }) : flat(look.iris[1]);
    const lidGeometry = new T.SphereGeometry(1, 24, 10, 0, TAU, 0, Math.PI / 2);
    for (const side of [-1, 1]) {
      const { x, y, r, out, tilt } = look.eye;
      const surface = hz * Math.sqrt(Math.max(.05, 1 - Math.pow(x / hx, 2) - Math.pow(y / hy, 2)));
      const eye = new T.Group(); eye.position.set(side * x, y, surface - r + out); head.add(eye);
      eye.rotation.set(0, side * .1, side * tilt * DEG);
      ellipsoid(materials.eye, null, [r, r, r], eye);
      const gaze = new T.Group(); eye.add(gaze);
      const iris = mesh(new T.SphereGeometry(r * 1.008, 24, 6, 0, TAU, 0, look.eye.iris), irisMaterial, null, null, gaze);
      iris.rotation.x = Math.PI / 2;
      ellipsoid(materials.light, [-r * .13, r * .17, r * .982], [.021, .024, .008], eye);
      ellipsoid(materials.light, [r * .12, -r * .12, r * .99], [.009, .009, .005], eye);
      const upper = new T.Group(); eye.add(upper);
      mesh(lidGeometry, materials.skin, null, [r * 1.035, r * 1.035, r * 1.035], upper);
      const lash = mesh(new T.TorusGeometry(r * 1.035, .0066, 6, 20, 150 * DEG), materials.lash, null, null, upper);
      lash.rotation.set(Math.PI / 2, 0, 15 * DEG);
      const lower = new T.Group(); eye.add(lower);
      mesh(lidGeometry, materials.skin, null, [r * 1.03, r * 1.03, r * 1.03], lower); // tucked inside the cheek until a blink or a laugh
      eyes.push({ gaze, upper, lower });
    }

    // ---- Hair: a tilted cap plus chunky tapered locks that follow the skull.
    function locksGeometry(locks) {
      const positions = [], normals = [], indices = [], rings = 12, around = 8;
      const radial = new T.Vector3(), sideways = new T.Vector3();
      for (const lock of locks) {
        const curve = new T.CatmullRomCurve3(lock.pts.map(p => onHead(p[0], p[1], p[2] || 0)));
        const start = positions.length / 3, root = lock.root === undefined ? .22 : lock.root;
        for (let i = 0; i <= rings; i++) {
          const s = i / rings, p = curve.getPoint(s), tangent = curve.getTangent(s).normalize();
          radial.copy(p).normalize().addScaledVector(tangent, -radial.dot(tangent)).normalize();
          sideways.crossVectors(tangent, radial).normalize();
          const swell = Math.pow(Math.max(0, Math.sin(Math.PI * (root + (1 - root) * Math.pow(s, .8)))), lock.blunt || .55);
          const w = Math.max(lock.w * swell, 1e-4), t = Math.max((lock.t || lock.w * .55) * swell, 1e-4);
          for (let j = 0; j < around; j++) {
            const a = j / around * TAU, cs = Math.cos(a), sn = Math.sin(a);
            positions.push(p.x + sideways.x * w * cs + radial.x * t * sn, p.y + sideways.y * w * cs + radial.y * t * sn, p.z + sideways.z * w * cs + radial.z * t * sn);
            const nx = sideways.x * cs / w + radial.x * sn / t, ny = sideways.y * cs / w + radial.y * sn / t, nz = sideways.z * cs / w + radial.z * sn / t;
            const length = Math.hypot(nx, ny, nz) || 1;
            normals.push(nx / length, ny / length, nz / length);
          }
        }
        for (let i = 0; i < rings; i++) for (let j = 0; j < around; j++) {
          const a = start + i * around + j, b = start + i * around + (j + 1) % around;
          indices.push(a, a + around, b, b, a + around, b + around);
        }
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      geometry.setIndex(indices);
      return geometry;
    }
    const cap = mesh(new T.SphereGeometry(1, 32, 16, 0, TAU, 0, look.cap.length * DEG), materials.hair[1], null, [hx * 1.045, hy * 1.045, hz * 1.05], head);
    cap.rotation.x = -look.cap.tilt * DEG;
    const locks = [];
    const lock = (tone, w, pts, extra) => locks.push({ tone, w, pts, ...extra });
    if (red) {
      // Rafa: parted on his right, long fringe sweeping across the forehead, a little tousled.
      for (let j = 0; j < 7; j++) {
        const part = 46 + j * 7;
        lock([1, 2, 1, 0, 2, 1, 0][j], .066, [[-38 + j, part, 0], [-12 + j * 5.5, Math.min(87, part + j * .5), .05 + (j % 2) * .01],
          [18 + j * 8.5, 36 + j * 5.3, .054], [42 + j * 8.3, 24.5 + j * 3.4, .03]]);
      }
      lock(1, .076, [[150, 84, 0], [70, 80, .07], [92, 58, .06], [101, 30, .03]]);
      lock(0, .07, [[140, 70, 0], [112, 62, .05], [112, 38, .045], [110, 14, .03]]);
      lock(1, .066, [[84, 62, .0], [93, 44, .055], [97, 22, .04], [95, 6, .024]]);
      lock(2, .045, [[66, 52, .02], [82, 47, .07], [93, 49, .1]], { root: .3 }); // cowlick
      lock(1, .056, [[-35, 47, 0], [-41, 39, .042], [-48, 29, .024]]);
      lock(0, .066, [[-42, 54, 0], [-57, 41, .05], [-68, 24, .028]]);
      lock(1, .07, [[-44, 64, 0], [-68, 49, .052], [-83, 26, .03]]);
      lock(0, .072, [[-48, 75, 0], [-86, 57, .05], [-99, 28, .03]]);
      lock(1, .07, [[-70, 84, 0], [-116, 62, .05], [-118, 30, .03]]);
      lock(0, .04, [[-73, 22, 0], [-72, 9, .022], [-71, -3, .012]]);
      lock(0, .04, [[76, 24, 0], [75, 10, .022], [73, -2, .012]]);
    } else {
      // Leo: short crop combed forward into a straight, slightly uneven fringe.
      const tips = [28, 32, 36.5, 35, 38.5, 36, 38, 33, 29];
      tips.forEach((tip, i) => {
        const yaw = (i - 4) * 14;
        lock(i % 3 === 1 ? 2 : i % 3 ? 1 : 0, .054, [[yaw * .35, 84, 0], [yaw * .8, 64, .04], [yaw + 2, 50, .036], [yaw + 4, tip, .018]], { t: .03, blunt: .32 });
      });
      for (const side of [-1, 1]) {
        lock(1, .056, [[side * 40, 80, 0], [side * 70, 56, .042], [side * 73, 34, .034], [side * 71, 20, .02]]);
        lock(0, .058, [[side * 70, 82, 0], [side * 92, 58, .04], [side * 94, 36, .034], [side * 93, 15, .02]]);
        lock(1, .058, [[side * 110, 80, 0], [side * 114, 56, .04], [side * 114, 34, .032], [side * 113, 13, .02]]);
        lock(0, .036, [[side * 74, 21, 0], [side * 73, 9, .02], [side * 72, -2, .01]]);
      }
      lock(2, .05, [[10, 86, .0], [22, 70, .06], [30, 56, .058]], { root: .3 });
    }
    materials.hair.forEach((material, tone) => {
      const strands = locks.filter(item => item.tone === tone);
      if (strands.length) mesh(locksGeometry(strands), material, null, null, head);
    });
    const brows = [];
    for (const side of [-1, 1]) {
      const brow = mesh(locksGeometry([{ w: look.brow3d.w, t: look.brow3d.w * .6, root: .12, pts: look.brow3d.pts.map(([yaw, pitch]) => [side * yaw, pitch, .004]) }]), materials.brow, null, null, head);
      brows.push(brow);
    }

    // ---- Helmet: glossy rear shell, clear bubble with painted reflections.
    const helmet = new T.Group(); helmet.position.set(0, 1.0, .03); helmet.name = 'helmet'; pose.add(helmet);
    const dome = [.665, .69, .6];
    mesh(new T.SphereGeometry(1, 32, 18, Math.PI, Math.PI), materials.shell, null, dome, helmet);
    // The padded lining keeps the face readable on any background, including the transparent fallback image.
    mesh(new T.SphereGeometry(1, 32, 18, Math.PI, Math.PI), toy('#2c3d68', 'cloth', { side: T.BackSide }), null, dome.map(size => size * .97), helmet);
    mesh(new T.TorusGeometry(.64, .055, 8, 44), materials.shell, [0, 0, .045], [1, 1.04, 1], helmet);
    mesh(new T.TorusGeometry(.682, .02, 6, 44), materials.accent, [0, 0, .04], [1, 1.04, 1], helmet);
    for (const side of [-1, 1]) {
      ellipsoid(materials.accent, [side * .65, 0, .02], [.085, .135, .1], helmet);
      ellipsoid(materials.metal, [side * .715, 0, .02], [.035, .08, .06], helmet);
    }
    const antenna = new T.Group(); antenna.position.set(-.6, .26, -.06); antenna.rotation.z = .5; helmet.add(antenna);
    mesh(new T.CylinderGeometry(.012, .016, .3, 8), materials.metal, [0, .15, 0], null, antenna);
    const beacon = ellipsoid(materials.lamp, [0, .32, 0], [.045, .045, .045], antenna);
    const visor = mesh(new T.SphereGeometry(1, 32, 18, 0, Math.PI), new T.MeshMatcapMaterial({
      matcap: glassMatcap(T, detail), transparent: true, blending: T.AdditiveBlending, depthWrite: false,
    }), null, dome, helmet);
    visor.renderOrder = 2;

    const rig = {
      red, joints, eyes, brows, pose, lamp, beacon, expression: 'smile',
      setExpression(next) {
        if (!canDraw || next === rig.expression) return;
        const texture = face(next);
        if (texture) { faceMaterial.map = texture; rig.expression = next; }
      },
    };
    // Non-enumerable references keep Object3D.toJSON() reusable.
    Object.defineProperty(astronaut.userData, 'joints', { value: joints, enumerable: false });
    Object.defineProperty(astronaut.userData, 'rig', { value: rig, enumerable: false });
    animate(astronaut, 0, true);
    return astronaut;
  }

  /* Start a short celebration: both arms up, a happy spin and a big laugh. */
  function cheer(model, seconds) {
    const rig = model.userData.rig;
    if (rig) rig.cheerAt = seconds;
  }
  /* Where the eyes look, each axis from -1 to 1 (x: viewer's right, y: up). */
  function lookAt(model, x, y) {
    const rig = model.userData.rig;
    if (rig) rig.target = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  }

  function animate(model, seconds, reducedMotion = false) {
    const rig = model.userData.rig;
    if (!rig) return;
    const { joints, red } = rig, look = LOOKS[red ? 'red' : 'blue'];
    const still = reducedMotion, t = still ? 0 : seconds, offset = red ? 1.9 : 0;
    const drift = still ? 0 : Math.sin(t * .7 + (red ? .5 : 2));
    // Wave hello for a few beats, then rest the arm, on a loop.
    const beat = (t * .16 + (red ? .45 : 0)) % 1;
    const waving = still ? 1 : smooth(0, .06, beat) * (1 - smooth(.42, .5, beat));
    const wave = still ? 0 : Math.sin(t * 6.4 + offset) * waving;
    let celebrate = 0, spin = 0;
    if (!still && rig.cheerAt !== undefined) {
      const c = t - rig.cheerAt;
      if (c >= 0 && c < 2.2) {
        celebrate = smooth(0, .25, c) * (1 - smooth(1.7, 2.2, c));
        spin = smooth(.15, 1.25, c) * TAU;
      } else if (c >= 2.2) rig.cheerAt = undefined;
    }
    rig.setExpression(celebrate > .2 ? 'laugh' : 'smile');
    const jump = Math.sin(Math.min(1, celebrate) * Math.PI * .5);
    rig.pose.rotation.y = spin;
    rig.pose.position.y = celebrate * .08 * Math.abs(Math.sin(t * 9));

    joints.leftArm.rotation.z = mix(red ? -.82 : -.62, -2.35, jump) + drift * .09;
    joints.leftArm.rotation.x = -.14;
    joints.leftElbow.rotation.set(-.32, 0, mix(0, .35, jump) + Math.sin(t * 9) * .2 * celebrate);
    joints.rightArm.rotation.z = mix(mix(1.25, red ? 2.2 : 2.05, waving), 2.4, jump) + wave * .1;
    joints.rightArm.rotation.x = -.16;
    joints.rightElbow.rotation.set(-.4, 0, mix(0, -.35, jump) + wave * .42 - Math.sin(t * 9) * .2 * celebrate);
    joints.leftLeg.rotation.z = -.17 + drift * .04 - jump * .12;
    joints.leftLeg.rotation.x = -.12 + (still ? 0 : Math.sin(t * .9 + offset) * .07);
    joints.rightLeg.rotation.z = .24 - drift * .04 + jump * .12;
    joints.rightLeg.rotation.x = .22 - (still ? 0 : Math.sin(t * .9 + offset) * .07);
    joints.head.rotation.z = (red ? -.06 : .05) + (still ? 0 : Math.sin(t * .6 + offset) * .035) + wave * .012;
    joints.head.rotation.y = still ? 0 : Math.sin(t * .5 + offset) * .07;
    joints.head.rotation.x = still ? 0 : Math.sin(t * .43 + offset) * .03 - celebrate * .1;

    // Blink, glance about and smile with the eyes.
    const cycle = (t + offset * 1.3) % (red ? 4.3 : 3.7);
    const blink = still ? 0 : cycle < .17 ? Math.sin(cycle / .17 * Math.PI) : (cycle > .42 && cycle < .56 && Math.floor((t + offset * 1.3) / (red ? 4.3 : 3.7)) % 3 === 0) ? Math.sin((cycle - .42) / .14 * Math.PI) : 0;
    const target = rig.target || { x: 0, y: 0 };
    const glanceX = target.x * 13 + (still ? 0 : Math.sin(t * .37 + offset) * 4 + Math.sin(t * .93) * 1.5);
    const glanceY = target.y * 9 + (still ? 0 : Math.sin(t * .29 + offset * 2) * 2.5);
    const upper = mix(look.eye.upper + glanceY * .35, -22, blink) - celebrate * 5;
    const lower = mix(look.eye.lower, 14, Math.max(celebrate * .8, blink * .6));
    for (const eye of rig.eyes) {
      eye.gaze.rotation.set(-glanceY * DEG, glanceX * DEG, 0);
      eye.upper.rotation.x = -upper * DEG;
      eye.lower.rotation.x = Math.PI + lower * DEG;
    }
    rig.brows.forEach(brow => { brow.position.y = celebrate * .018 + blink * -.004; });
    const pulse = still ? 1 : .78 + Math.sin(t * 2.4 + offset) * .22;
    rig.lamp.scale.setScalar(.036 * pulse); rig.lamp.scale.z = .02;
    rig.beacon.scale.setScalar(.045 * (still ? 1 : .85 + Math.sin(t * 3.1 + offset) * .15));
  }

  return { create, animate, cheer, lookAt };
});
