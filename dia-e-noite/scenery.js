/* Scenery for the two views. Decoration only: the shared angle, the Earth map,
 * the markers and the tested solar disk stay in app.js. Every animation here is
 * driven by the caller's motion clock, so pausing motion freezes both scenes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DayNightScenery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const random = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function canvasTexture(T, width, height, paint) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    paint(canvas.getContext('2d'), width, height);
    const texture = new T.CanvasTexture(canvas); texture.encoding = T.sRGBEncoding;
    return texture;
  }
  function glowTexture(T, stops) {
    return canvasTexture(T, 128, 128, c => {
      const gradient = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      stops.forEach(([at, color]) => gradient.addColorStop(at, color));
      c.fillStyle = gradient; c.fillRect(0, 0, 128, 128);
    });
  }
  function pointCloud(T, positions, material) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    return new T.Points(geometry, material);
  }

  // ---- Space: nebula backdrop, twinkling stars, a glowing Sun and flowing light.
  function space(T, { scene, earthRoot, spinningEarth, earthRadius, sunPosition, sunLight, pulse }) {
    const next = random(11);
    scene.background = canvasTexture(T, 1024, 768, (c, w, h) => {
      const base = c.createLinearGradient(0, 0, w, h);
      base.addColorStop(0, '#0b1230'); base.addColorStop(.55, '#111d44'); base.addColorStop(1, '#0d1638');
      c.fillStyle = base; c.fillRect(0, 0, w, h);
      for (const [x, y, r, color] of [[.78, .2, .5, 'rgba(96,72,190,.3)'], [.2, .86, .46, 'rgba(34,128,170,.22)'], [.6, .95, .4, 'rgba(176,72,140,.14)'], [.05, .1, .36, 'rgba(255,190,90,.1)']]) {
        const cloud = c.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
        cloud.addColorStop(0, color); cloud.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = cloud; c.fillRect(0, 0, w, h);
      }
      for (let i = 0; i < 260; i++) {
        const size = next() < .08 ? 1.5 : next() < .3 ? 1 : .6;
        c.fillStyle = `rgba(${220 + Math.round(next() * 35)},${228 + Math.round(next() * 27)},255,${.25 + next() * .6})`;
        c.beginPath(); c.arc(next() * w, next() * h, size, 0, TAU); c.fill();
      }
    });

    const spark = glowTexture(T, [[0, 'rgba(255,255,255,1)'], [.25, 'rgba(235,244,255,.75)'], [1, 'rgba(200,225,255,0)']]);
    const twinkles = [3.2, 4.4, 5.6].map((size, group) => {
      const positions = [];
      for (let i = 0; i < 16; i++) positions.push((next() - .5) * 17, (next() - .5) * 12, -6);
      const material = new T.PointsMaterial({ map: spark, size, transparent: true, depthWrite: false, color: group === 1 ? '#ffe9c2' : '#dcecff' });
      scene.add(pointCloud(T, positions, material));
      return material;
    });

    const sun = new T.Group(); sun.position.copy(sunPosition); scene.add(sun);
    const layer = (map, scale, extra) => {
      const sprite = new T.Sprite(new T.SpriteMaterial({ map, transparent: true, depthWrite: false, ...extra }));
      sprite.scale.set(scale, scale, 1); sun.add(sprite); return sprite;
    };
    const corona = layer(glowTexture(T, [[0, 'rgba(255,214,120,.85)'], [.28, 'rgba(255,186,84,.4)'], [.6, 'rgba(255,160,70,.12)'], [1, 'rgba(255,150,60,0)']]), 3.6, { blending: T.AdditiveBlending });
    const rayMap = canvasTexture(T, 256, 256, c => {
      c.translate(128, 128);
      for (let i = 0; i < 12; i++) {
        const long = i % 2 === 0, reach = long ? 124 : 96, gradient = c.createLinearGradient(0, 0, reach, 0);
        gradient.addColorStop(0, 'rgba(255,226,140,.0)'); gradient.addColorStop(.32, 'rgba(255,226,140,.55)'); gradient.addColorStop(1, 'rgba(255,210,110,0)');
        c.fillStyle = gradient; c.beginPath(); c.moveTo(34, -9); c.lineTo(reach, 0); c.lineTo(34, 9); c.closePath(); c.fill();
        c.rotate(TAU / 12);
      }
    });
    const rays = [layer(rayMap, 2.5, { blending: T.AdditiveBlending }), layer(rayMap, 2.05, { blending: T.AdditiveBlending, opacity: .6 })];
    layer(glowTexture(T, [[0, '#fffbe6'], [.45, '#ffe58a'], [.8, '#ffc34d'], [.93, '#ffb035'], [1, 'rgba(255,170,50,0)']]), 1.08);

    // Light travels from the Sun to the Earth: three streams of drifting chevrons.
    const beamMap = canvasTexture(T, 128, 32, c => {
      c.strokeStyle = '#fff1bd'; c.lineWidth = 6; c.lineCap = c.lineJoin = 'round';
      for (const x of [20, 84]) { c.beginPath(); c.moveTo(x, 6); c.lineTo(x + 14, 16); c.lineTo(x, 26); c.stroke(); }
    });
    beamMap.wrapS = T.RepeatWrapping; beamMap.repeat.set(3, 1);
    const reach = earthRoot.position.x - earthRadius - .18, start = sunPosition.x + .82;
    for (const y of [-.58, 0, .58]) {
      const beam = new T.Sprite(new T.SpriteMaterial({ map: beamMap, transparent: true, opacity: .8, depthWrite: false }));
      beam.scale.set(reach - start, .2, 1); beam.position.set((reach + start) / 2, y, 0); scene.add(beam);
    }

    // Thin air glowing on the sunlit side, and a slow layer of cloud.
    const sunward = new T.Vector3().subVectors(sunPosition, earthRoot.position).normalize();
    const air = new T.Mesh(new T.SphereGeometry(earthRadius * 1.1, 48, 32), new T.ShaderMaterial({
      uniforms: { sunward: { value: sunward }, tint: { value: new T.Color('#74c8ff').convertSRGBToLinear() } },
      vertexShader: 'varying vec3 seen; varying vec3 outward; void main(){ seen = normalize(normalMatrix * normal); outward = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 sunward; uniform vec3 tint; varying vec3 seen; varying vec3 outward; void main(){ float rim = 0.75 * pow(clamp(0.5 - dot(normalize(seen), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 4.0); float lit = 0.12 + 0.88 * smoothstep(-0.45, 0.55, dot(normalize(outward), sunward)); gl_FragColor = linearToOutputTexel(vec4(tint * rim * lit, 1.0)); }',
      side: T.BackSide, blending: T.AdditiveBlending, transparent: true, depthWrite: false,
    }));
    earthRoot.add(air);
    const cloudMap = canvasTexture(T, 1024, 512, (c, w, h) => {
      const place = random(5);
      for (let i = 0; i < 46; i++) {
        const x = place() * w, y = h * (.16 + place() * .68), size = 16 + place() * 34;
        for (let puff = 0; puff < 5; puff++) {
          const px = x + (puff - 2) * size * .55, py = y + (place() - .5) * size * .5, r = size * (.6 + place() * .5);
          for (const shift of [-w, 0, w]) {
            const gradient = c.createRadialGradient(px + shift, py, 0, px + shift, py, r);
            gradient.addColorStop(0, 'rgba(255,255,255,.75)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = gradient; c.fillRect(px + shift - r, py - r, r * 2, r * 2);
          }
        }
      }
    });
    cloudMap.wrapS = T.RepeatWrapping;
    const weather = new T.Mesh(new T.SphereGeometry(earthRadius * 1.012, 48, 32), new T.MeshLambertMaterial({ map: cloudMap, transparent: true, opacity: .85, depthWrite: false }));
    spinningEarth.add(weather);
    if (sunLight) sunLight.intensity = 1.5;

    return {
      update(time) {
        twinkles.forEach((material, group) => { material.opacity = .45 + .5 * (.5 + .5 * Math.sin(time * (1.3 + group * .55) + group * 2.1)); });
        rays[0].material.rotation = time * .12; rays[1].material.rotation = -time * .09 + .26;
        const breath = 1 + Math.sin(time * 1.1) * .035;
        corona.scale.set(3.6 * breath, 3.6 * breath, 1);
        beamMap.offset.x = -(time * .55) % 1;
        weather.rotation.y = time * .025;
        if (pulse) { const beat = 1 + .28 * (.5 + .5 * Math.sin(time * 3.2)); pulse.scale.set(beat, beat, 1); }
      },
    };
  }

  // ---- Garden: a sky that changes colour, a small house, trees and the child who lives there.
  function garden(T, { scene, camera, renderer }) {
    const next = random(23), eye = camera.position.y;
    const shade = hex => new T.Color(hex), srgb = hex => new T.Color(hex).convertSRGBToLinear();
    const lambert = hex => new T.MeshLambertMaterial({ color: srgb(hex) });
    function add(geometry, material, x, y, z, parent = scene, shadow = true) {
      const part = new T.Mesh(geometry, typeof material === 'string' ? lambert(material) : material);
      part.position.set(x, y, z); part.castShadow = shadow; part.receiveShadow = !shadow; parent.add(part);
      return part;
    }
    const ball = new T.SphereGeometry(1, 16, 12);
    const blob = (material, x, y, z, sx, sy, sz, parent) => { const part = add(ball, material, x, y, z, parent); part.scale.set(sx, sy, sz); return part; };

    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
    const ambient = new T.HemisphereLight('#e3f4ff', '#5c9a58', 1); scene.add(ambient);
    const daylight = new T.DirectionalLight('#fff1cd', 1); scene.add(daylight, daylight.target);
    daylight.target.position.set(0, 0, -5);
    daylight.shadow.mapSize.set(1024, 1024); daylight.shadow.bias = -.0012; daylight.shadow.normalBias = .04;
    Object.assign(daylight.shadow.camera, { left: -15, right: 15, top: 16, bottom: -12, near: 1, far: 90 });
    daylight.shadow.camera.updateProjectionMatrix();
    const lamp = new T.PointLight('#ffc878', 0, 11, 1.6); lamp.position.set(3.2, 1.5, -4.9); scene.add(lamp);
    const fog = new T.Fog('#bfe6f2', 30, 110); scene.fog = fog;

    // Sky: four bands of vertex colour from horizon to zenith, behind everything.
    const sky = new T.Mesh(new T.PlaneGeometry(2400, 300, 1, 3), new T.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false }));
    sky.position.set(0, eye + 126, -430); sky.renderOrder = -2; scene.add(sky);
    const skyColors = new T.Float32BufferAttribute(new Float32Array(8 * 3), 3); sky.geometry.setAttribute('color', skyColors);
    const palette = {
      zenith: [shade('#0a1338'), shade('#2f8fd8'), shade('#5a5fa8')], high: [shade('#111d49'), shade('#56b3e6'), shade('#b0789f')],
      low: [shade('#1c2a5e'), shade('#9bdcf1'), shade('#f6a37c')], horizon: [shade('#2b3b74'), shade('#d6f3f4'), shade('#ffcf8f')],
    };
    const blended = {}; for (const key of Object.keys(palette)) blended[key] = new T.Color();
    const linear = new T.Color();

    const halo = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({
      map: glowTexture(T, [[0, 'rgba(255,240,190,.95)'], [.22, 'rgba(255,224,150,.5)'], [.55, 'rgba(255,196,120,.16)'], [1, 'rgba(255,180,100,0)']]),
      transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false,
      clippingPlanes: [new T.Plane(new T.Vector3(0, 1, 0), -eye)],
    }));
    halo.renderOrder = -1; scene.add(halo);

    const spark = glowTexture(T, [[0, 'rgba(255,255,255,1)'], [.3, 'rgba(232,240,255,.7)'], [1, 'rgba(210,226,255,0)']]);
    const starGroups = [.55, .8, 1.15].map((size, group) => {
      const positions = [];
      for (let i = 0; i < 46; i++) positions.push((next() - .5) * 130, eye + 2 + Math.pow(next(), 1.3) * 62, -110);
      const material = new T.PointsMaterial({ map: spark, size: size * 2.2, transparent: true, depthWrite: false, fog: false, opacity: 0, color: group === 2 ? '#fff3d0' : '#e6eeff' });
      scene.add(pointCloud(T, positions, material));
      return material;
    });

    const cloudMaterial = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9, fog: false, depthWrite: false });
    const clouds = [[-9, 9.5, -30, 1.5], [7.5, 11.5, -36, 1.9], [-1.5, 13.5, -44, 2.2], [17, 8.5, -40, 1.4], [-20, 12, -46, 1.8]].map(([x, y, z, s]) => {
      const cloud = new T.Group(); cloud.position.set(x, y, z); cloud.userData.x = x; scene.add(cloud);
      for (const [px, py, r] of [[-1.5, 0, .85], [-.6, .35, 1.15], [.5, .45, 1.3], [1.5, .05, .95], [0, -.2, 1.25]]) {
        const puff = new T.Mesh(ball, cloudMaterial); puff.position.set(px * s, py * s, 0); puff.scale.set(r * s, r * s * .62, r * s * .5); cloud.add(puff);
      }
      return cloud;
    });

    // Ground, soft rises, a winding path and far hills that leave both ends of the horizon open.
    const grass = lambert('#7cc35c');
    const lawn = add(new T.PlaneGeometry(1200, 1200), grass, 0, 0, -20, scene, false); lawn.rotation.x = -Math.PI / 2;
    for (const [x, z, sx, sz, color] of [[-7, -13, 9, 5, '#86cb62'], [8, -17, 10, 6, '#72ba58'], [0, -27, 15, 6, '#80c560']]) {
      const rise = blob(lambert(color), x, -.55, z, sx, 1.05, sz); rise.castShadow = false; rise.receiveShadow = true;
    }
    for (const [x, z, s, color] of [[-13, -52, 15, '#74b96a'], [9, -60, 19, '#68ad6c'], [-33, -70, 13, '#7dbd72'], [34, -74, 15, '#70b470']]) {
      const hill = blob(lambert(color), x, -s * .74, z, s * 1.25, s, s * .5); hill.castShadow = false;
    }
    {
      const curve = new T.CatmullRomCurve3([[3.65, 0, -5.8], [3.3, 0, -3.6], [1.7, 0, -1.5], [.9, 0, .8], [1.5, 0, 3.4]].map(p => new T.Vector3(...p)));
      const positions = [], indices = [];
      for (let i = 0; i <= 40; i++) {
        const p = curve.getPoint(i / 40), tangent = curve.getTangent(i / 40), width = .5 + i / 40 * .35;
        positions.push(p.x - tangent.z * width, .025, p.z + tangent.x * width, p.x + tangent.z * width, .025, p.z - tangent.x * width);
        if (i < 40) indices.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
      const path = add(geometry, new T.MeshLambertMaterial({ color: srgb('#ecd9a5'), side: T.DoubleSide }), 0, 0, 0, scene, false);
      path.receiveShadow = true;
    }

    const leaves = ['#4c9f57', '#5fb05c', '#77c165'].map(lambert), bark = lambert('#8d6243'), apple = lambert('#e9483f');
    for (const [x, z, s, fruit] of [[-4.6, -6.5, 1.15, true], [5.6, -10.5, 1.25], [-8, -15, 1.55], [8.6, -20, 1.6], [-3.4, -19, 1.25], [-12.5, -9, 1.3]]) {
      const tree = new T.Group(); tree.position.set(x, 0, z); tree.scale.setScalar(s); scene.add(tree);
      add(new T.CylinderGeometry(.13, .24, 1.9, 9), bark, 0, .95, 0, tree);
      for (const [px, py, pz, r, tone] of [[0, 2.55, 0, 1.15, 0], [-.7, 2.15, .25, .82, 1], [.72, 2.25, .1, .86, 1], [.05, 3.2, .1, .8, 2], [-.3, 2.6, .7, .7, 2]]) blob(leaves[tone], px, py, pz, r, r * .92, r, tree);
      if (fruit) for (const [px, py, pz] of [[-.55, 2.1, 1.0], [.35, 2.75, 1.02], [.8, 2.05, .78], [-.15, 3.25, .82], [-.95, 2.7, .55]]) blob(apple, px, py, pz, .1, .1, .1, tree);
    }
    for (const [x, z, s] of [[-6.6, -3.6, .7], [6.4, -4.4, .8], [1.2, -8.6, .6], [-2.2, -11, .75]]) {
      for (const [px, r, tone] of [[-.5, .5, 0], [.1, .62, 1], [.62, .45, 2]]) blob(leaves[tone], x + px * s, r * s * .7, z, r * s, r * s * .82, r * s);
    }

    // A cosy house whose windows light up as it gets dark. Its pale walls and the plain
    // window light stay clear of the solar disk's exact colour, which the tests count.
    const home = new T.Group(); home.position.set(3.35, 0, -7); scene.add(home);
    add(new T.BoxGeometry(2.7, 1.95, 2.3), '#fff6e6', 0, .975, 0, home);
    add(new T.BoxGeometry(2.8, .22, 2.4), '#e9cf9a', 0, .11, 0, home);
    const gable = new T.Shape(); gable.moveTo(-1.72, 0); gable.lineTo(0, 1.3); gable.lineTo(1.72, 0); gable.closePath();
    const roof = add(new T.ExtrudeGeometry(gable, { depth: 2.8, bevelEnabled: false }), '#e4674f', 0, 1.93, -1.4, home);
    roof.name = 'roof';
    add(new T.BoxGeometry(.34, .8, .34), '#d95b46', -.75, 2.85, -.3, home);
    add(new T.BoxGeometry(.44, .12, .44), '#fbf5ea', -.75, 3.28, -.3, home);
    add(new T.BoxGeometry(.62, 1.22, .06), '#7b5a45', .2, .72, 1.16, home);
    add(new T.BoxGeometry(.8, .1, .3), '#d9c79e', .2, .06, 1.3, home);
    blob(lambert('#ffd15c'), .4, .7, 1.2, .04, .04, .04, home);
    const windowMaterial = new T.MeshBasicMaterial({ color: srgb('#9fd0e0') }), frame = lambert('#ffffff');
    const paneDay = srgb('#9fd0e0'), paneNight = srgb('#ffdf94');
    for (const x of [-.82, .98]) {
      add(new T.BoxGeometry(.64, .68, .05), frame, x, 1.3, 1.15, home);
      add(new T.BoxGeometry(.52, .56, .06), windowMaterial, x, 1.3, 1.16, home, false);
      add(new T.BoxGeometry(.04, .56, .07), frame, x, 1.3, 1.165, home); add(new T.BoxGeometry(.52, .04, .07), frame, x, 1.3, 1.165, home);
      add(new T.BoxGeometry(.7, .09, .16), '#e4674f', x, .93, 1.2, home);
      for (const [dx, color] of [[-.2, '#ff7fa0'], [0, '#ffd166'], [.2, '#ffffff']]) blob(lambert(color), x + dx, 1.03, 1.22, .07, .07, .07, home);
    }
    for (let i = 0; i < 9; i++) {
      add(new T.BoxGeometry(.13, .72, .08), '#fbf6e6', -6.6 + i * .52, .36, -4.2);
      const tip = add(new T.ConeGeometry(.092, .14, 4), '#fbf6e6', -6.6 + i * .52, .79, -4.2); tip.rotation.y = Math.PI / 4;
    }
    for (const y of [.26, .54]) add(new T.BoxGeometry(4.4, .08, .05), '#fbf6e6', -4.52, y, -4.25);

    // Flowers and grass tufts share three instanced meshes.
    const spots = [];
    for (let i = 0; i < 70; i++) {
      const z = 2.2 - Math.pow(next(), 1.4) * 15, x = (next() - .5) * (9 + (2.2 - z) * 1.5);
      if (Math.abs(x - 1.6) < 1.5 && z > -5.5) continue; // keep the path clear
      if (Math.hypot(x + 1.7, z - .45) < .8) continue; // and the child's spot
      spots.push([x, z]);
    }
    const dummy = new T.Object3D(), tones = ['#ff6f91', '#ffd166', '#ffffff', '#b99cff', '#ff9a5c', '#ff8fb8'];
    const stems = new T.InstancedMesh(new T.CylinderGeometry(.014, .018, .3, 5), lambert('#4f9a4b'), spots.length);
    const petals = new T.InstancedMesh(new T.SphereGeometry(.12, 10, 8), new T.MeshLambertMaterial({ color: '#ffffff' }), spots.length);
    const hearts = new T.InstancedMesh(new T.SphereGeometry(.055, 8, 6), lambert('#ffcf4a'), spots.length);
    spots.forEach(([x, z], i) => {
      const tall = .2 + next() * .16;
      dummy.position.set(x, tall / 2, z); dummy.scale.set(1, tall / .3, 1); dummy.updateMatrix(); stems.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, tall + .03, z); dummy.scale.set(1, .62, 1); dummy.updateMatrix(); petals.setMatrixAt(i, dummy.matrix);
      petals.setColorAt(i, linear.set(tones[i % tones.length]).convertSRGBToLinear());
      dummy.position.set(x, tall + .075, z); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); hearts.setMatrixAt(i, dummy.matrix);
    });
    scene.add(stems, petals, hearts);

    // The child stands with their back to us, looking at the same sky. Shirt colour marks the place.
    const child = new T.Group(); child.position.set(-1.7, 0, .45); scene.add(child);
    const skin = lambert('#f1c7a4'), shirt = lambert('#ec5c84'), shorts = lambert('#3f5b8f'), hair = lambert('#6e4526'), shoe = lambert('#f6f1df');
    for (const x of [-.115, .115]) {
      add(new T.CylinderGeometry(.062, .056, .34, 10), skin, x, .26, 0, child);
      blob(shoe, x, .06, -.03, .085, .06, .14, child);
      blob(shorts, x, .52, 0, .115, .15, .12, child);
    }
    const torso = blob(shirt, 0, .86, 0, .225, .3, .17, child);
    blob(shorts, 0, .6, 0, .215, .1, .16, child);
    const arms = [-1, 1].map(side => {
      const arm = new T.Group(); arm.position.set(side * .23, 1.02, 0); arm.rotation.z = side * .16; child.add(arm);
      blob(shirt, 0, -.06, 0, .085, .12, .085, arm);
      add(new T.CylinderGeometry(.052, .046, .34, 10), skin, 0, -.28, 0, arm);
      blob(skin, 0, -.47, 0, .055, .06, .055, arm);
      return arm;
    });
    const head = new T.Group(); head.position.set(0, 1.36, 0); child.add(head);
    add(new T.CylinderGeometry(.06, .07, .1, 10), skin, 0, -.2, 0, head);
    blob(skin, 0, 0, 0, .225, .235, .215, head);
    for (const side of [-1, 1]) blob(skin, side * .22, -.02, 0, .04, .06, .035, head);
    const crown = add(new T.SphereGeometry(1, 22, 14, 0, TAU, 0, Math.PI * .62), hair, 0, .02, 0, head);
    crown.scale.set(.236, .246, .228); crown.rotation.x = .42; // the crop reaches the nape, seen from behind
    for (const [x, y, z, r] of [[-.08, .2, -.06, .09], [.07, .21, -.02, .1], [0, .22, .08, .09], [-.13, .12, .12, .07], [.13, .13, .1, .07]]) blob(hair, x, y, z, r, r * .6, r, head);
    head.rotation.x = .16; // chin up, toward the sky
    const contact = add(new T.CircleGeometry(.42, 28), new T.MeshBasicMaterial({ color: srgb('#27402a'), transparent: true, opacity: .22, depthWrite: false }), -1.7, .03, .45, scene, false);
    contact.rotation.x = -Math.PI / 2; contact.receiveShadow = false;

    const fireflyPositions = new Float32Array(14 * 3), homes = [];
    for (let i = 0; i < 14; i++) homes.push([(next() - .5) * 13, .5 + next() * 1.8, 1.5 - next() * 9, next() * TAU]);
    const fireflies = new T.Points(new T.BufferGeometry(), new T.PointsMaterial({ map: spark, color: '#eaff8a', size: .34, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    fireflies.geometry.setAttribute('position', new T.BufferAttribute(fireflyPositions, 3)); fireflies.frustumCulled = false; scene.add(fireflies);

    const warm = new T.Color('#ffb074'), noon = new T.Color('#fff3d6'), moonless = new T.Color('#b9cdfa'), pink = srgb('#ec5c84'), teal = srgb('#36bfa0');
    const cloudDay = srgb('#ffffff'), cloudDusk = srgb('#ffc3a0'), cloudNight = srgb('#34427a'), horizon = new T.Color();
    let shadows = true;
    return {
      // Slower devices trade the soft shadows for a steady frame rate.
      setShadows(enabled) { shadows = enabled; daylight.castShadow = false; renderer.shadowMap.needsUpdate = true; },
      update(state, time, observerIndex, sunPosition, worldChanged) {
        const light = state.daylight, glowing = Math.max(0, 1 - Math.abs(state.elevation) / .45), dusk = glowing * .78;
        if (worldChanged) {
          const order = ['horizon', 'low', 'high', 'zenith'];
          order.forEach((key, row) => {
            const [night, day, twilight] = palette[key];
            blended[key].copy(night).lerp(day, light).lerp(twilight, dusk * (row < 2 ? 1 : .55));
            linear.copy(blended[key]).convertSRGBToLinear();
            // PlaneGeometry lists its top row first.
            for (const column of [0, 1]) skyColors.setXYZ((3 - row) * 2 + column, linear.r, linear.g, linear.b);
          });
          skyColors.needsUpdate = true;
          horizon.copy(blended.horizon).convertSRGBToLinear();
          scene.background = horizon; fog.color.copy(horizon);
          ambient.intensity = .34 + light * .2; ambient.color.copy(moonless).lerp(noon, light);
          daylight.intensity = Math.max(0, Math.min(1, state.elevation * 2.4)) * .6;
          daylight.color.copy(noon).lerp(warm, glowing);
          daylight.position.set(Math.sin(state.angle) * 26, Math.max(1.2, state.elevation * 34), -34);
          daylight.castShadow = shadows && state.elevation > .04; renderer.shadowMap.needsUpdate = true;
          lamp.intensity = (1 - light) * 1.25;
          windowMaterial.color.copy(light > .5 ? paneDay : paneNight);
          cloudMaterial.color.copy(cloudNight).lerp(cloudDay, light).lerp(cloudDusk, dusk * .8);
          cloudMaterial.opacity = .28 + light * .64;
          shirt.color.copy(observerIndex ? teal : pink);
          halo.position.set(sunPosition.x, sunPosition.y, sunPosition.z - 2);
          const spread = 62 + glowing * 70; halo.scale.set(spread, spread, 1);
          halo.material.opacity = (.5 + glowing * .4) * smooth(-.3, .02, state.elevation);
        }
        const dark = Math.pow(1 - light, 3) * (1 - dusk);
        starGroups.forEach((material, group) => { material.opacity = dark * (.55 + .45 * Math.sin(time * (1.1 + group * .5) + group * 1.9)); });
        clouds.forEach((cloud, i) => { cloud.position.x = cloud.userData.x + Math.sin(time * .035 + i * 1.7) * 2.2; });
        fireflies.material.opacity = Math.pow(1 - light, 2) * (.65 + .35 * Math.sin(time * 2.3));
        homes.forEach(([x, y, z, phase], i) => {
          fireflyPositions[i * 3] = x + Math.sin(time * .5 + phase) * .9;
          fireflyPositions[i * 3 + 1] = y + Math.sin(time * .8 + phase * 2) * .35;
          fireflyPositions[i * 3 + 2] = z + Math.cos(time * .4 + phase) * .7;
        });
        fireflies.geometry.attributes.position.needsUpdate = true;
        const breath = Math.sin(time * 1.6);
        torso.scale.y = .3 + breath * .006; head.rotation.z = Math.sin(time * .45) * .05;
        arms.forEach((arm, i) => { arm.rotation.x = Math.sin(time * .8 + i * 2.4) * .06; });
      },
    };
  }

  return { space, garden };
});
