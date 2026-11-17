/* Leo and Rafa: reusable, fully three-dimensional toy astronauts.
 * Reference: the two children in assets/trio-do-saber.png.
 * Model faces +Z; approximately 2.9 units tall, with the chest near the origin.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrioAstronauts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function create(T, options = {}) {
    const red = options.variant === 'red';
    const name = String(options.name || (red ? 'Rafa' : 'Leo'));
    const astronaut = new T.Group();
    astronaut.name = `astronaut-${name.toLowerCase()}`;
    astronaut.userData = { name, variant: red ? 'red' : 'blue', kind: 'trio-astronaut' };

    function material(hex, options = {}) {
      const color = new T.Color(hex).convertSRGBToLinear();
      return new T.MeshPhongMaterial({
        color,
        emissive: color.clone(),
        emissiveIntensity: .12,
        shininess: 18,
        specular: new T.Color('#48525d').convertSRGBToLinear(),
        ...options,
      });
    }
    const materials = {
      suit: material('#f1f6ef', { shininess: 18, emissiveIntensity: .12 }),
      suitShade: material('#cbdbe5', { emissiveIntensity: .12 }),
      accent: material(red ? '#e75b45' : '#459edd', { emissiveIntensity: .13 }),
      dark: material(red ? '#8a302e' : '#23587b'),
      skin: material(red ? '#f2b575' : '#efb17a', { shininess: 8, emissiveIntensity: .16, specular: new T.Color('#593b2c').convertSRGBToLinear() }),
      ear: material('#d98a61', { shininess: 8, emissiveIntensity: .13, specular: new T.Color('#42281c').convertSRGBToLinear() }),
      cheek: material('#f1a282', { shininess: 6, emissiveIntensity: .16, specular: new T.Color('#29170f').convertSRGBToLinear() }),
      hair: material(red ? '#6c3717' : '#75401c', { shininess: 12, emissiveIntensity: .12, specular: new T.Color('#54341f').convertSRGBToLinear() }),
      hairLight: material(red ? '#995325' : '#965528', { shininess: 12, emissiveIntensity: .12, specular: new T.Color('#54341f').convertSRGBToLinear() }),
      eye: material('#fffbef', { shininess: 35, emissiveIntensity: .18 }),
      iris: material(red ? '#3f93cf' : '#85451c', { shininess: 35, emissiveIntensity: .13 }),
      pupil: material('#211710', { shininess: 35, emissiveIntensity: .10 }),
      mouth: material('#74251c', { shininess: 4, emissiveIntensity: .13, specular: new T.Color('#110806').convertSRGBToLinear() }),
      tongue: material('#ef7c75', { shininess: 8, emissiveIntensity: .14, specular: new T.Color('#29170f').convertSRGBToLinear() }),
      light: new T.MeshBasicMaterial({ color: '#ffffff' }),
      gold: material('#ffd56b', { shininess: 24, emissiveIntensity: .13 }),
    };
    const sphereGeometry = new T.SphereGeometry(1, 24, 16);
    function mesh(geometry, mat, position, scale, parent = astronaut) {
      const part = new T.Mesh(geometry, mat);
      if (position) part.position.set(...position);
      if (scale) part.scale.set(...scale);
      parent.add(part);
      return part;
    }
    function ellipsoid(mat, position, scale, parent = astronaut) {
      return mesh(sphereGeometry, mat, position, scale, parent);
    }
    function tube(points, radius, mat, parent = astronaut) {
      const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
      return mesh(new T.TubeGeometry(curve, 16, radius, 6, false), mat, null, null, parent);
    }
    function ring(radius, thickness, mat, position, scale, parent = astronaut) {
      return mesh(new T.TorusGeometry(radius, thickness, 8, 36), mat, position, scale, parent);
    }

    // The pack remains distinct when the astronauts gently turn in space.
    ellipsoid(materials.suitShade, [0, .03, -.27], [.38, .47, .19]);
    for (const x of [-.25, .25]) {
      ellipsoid(materials.suit, [x, .02, -.40], [.105, .36, .105]);
      ring(.105, .025, materials.accent, [x, -.10, -.4], [1, 1, 1]).rotation.x = Math.PI / 2;
    }
    ellipsoid(materials.suit, [0, .02, 0], [.40, .48, .26]);
    ellipsoid(materials.accent, [0, .29, .105], [.34, .13, .20]);
    const belt = ring(.32, .052, materials.accent, [0, -.32, 0], [1, .75, 1]);
    belt.rotation.x = Math.PI / 2;
    const collar = ring(.245, .07, materials.suitShade, [0, .48, 0], [1, 1, 1]);
    collar.rotation.x = Math.PI / 2;

    // Chest panel and sewn name patch. The only raster is this small suit detail.
    ellipsoid(materials.suitShade, [0, .015, .249], [.25, .23, .045]);
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 256;
      const c = canvas.getContext('2d');
      c.fillStyle = '#eff5ed'; c.fillRect(0, 0, 512, 256);
      c.fillStyle = red ? '#9d392c' : '#235c82';
      c.font = 'bold 108px "Trebuchet MS", sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name.toUpperCase(), 256, 104, 440);
      c.fillStyle = red ? '#e75b45' : '#459edd';
      c.fillRect(70, 196, 372, 13);
      const texture = new T.CanvasTexture(canvas); texture.encoding = T.sRGBEncoding;
      mesh(new T.PlaneGeometry(.38, .19), new T.MeshBasicMaterial({ map: texture }), [0, .075, .295]);
    }
    for (const [x, mat] of [[-.12, materials.accent], [0, materials.gold], [.12, materials.light]]) {
      ellipsoid(mat, [x, -.10, .296], [.035, .035, .015]);
    }

    const joints = {};
    function arm(side) {
      const joint = new T.Group();
      joint.position.set(side * .39, .28, .005);
      joint.name = side < 0 ? 'left-shoulder' : 'right-shoulder';
      astronaut.add(joint);
      ellipsoid(materials.accent, [0, -.025, 0], [.16, .17, .165], joint);
      ellipsoid(materials.suit, [0, -.24, .015], [.13, .24, .13], joint);
      const elbow = new T.Group(); elbow.position.set(0, -.43, .02); joint.add(elbow);
      elbow.rotation.x = -.30;
      ellipsoid(materials.suitShade, [0, 0, 0], [.125, .10, .125], elbow);
      ellipsoid(materials.suit, [0, -.15, .015], [.12, .18, .12], elbow);
      const cuff = ring(.10, .035, materials.accent, [0, -.29, .015], [1, 1, 1], elbow);
      cuff.rotation.x = Math.PI / 2;
      ellipsoid(materials.suit, [0, -.40, .025], [.12, .14, .105], elbow);
      ellipsoid(materials.suit, [side * .10, -.36, .09], [.057, .085, .055], elbow).rotation.z = side * -.45;
      joints[side < 0 ? 'leftArm' : 'rightArm'] = joint;
      joints[side < 0 ? 'leftElbow' : 'rightElbow'] = elbow;
    }
    arm(-1); arm(1);
    function leg(side) {
      const joint = new T.Group();
      joint.position.set(side * .18, -.35, 0);
      joint.name = side < 0 ? 'left-hip' : 'right-hip';
      astronaut.add(joint);
      ellipsoid(materials.suit, [0, -.24, 0], [.16, .29, .17], joint);
      ellipsoid(materials.accent, [0, -.41, .112], [.125, .105, .06], joint);
      ellipsoid(materials.suit, [0, -.59, .015], [.145, .19, .15], joint);
      const boot = ellipsoid(materials.suitShade, [0, -.78, .075], [.17, .14, .235], joint);
      ellipsoid(materials.accent, [0, -.86, .075], [.175, .055, .235], joint);
      ellipsoid(materials.suit, [0, -.745, .21], [.145, .08, .105], joint);
      joints[side < 0 ? 'leftLeg' : 'rightLeg'] = joint;
    }
    leg(-1); leg(1);

    const head = new T.Group(); head.position.set(0, .96, .055); astronaut.add(head);
    head.name = 'head'; joints.head = head;
    const roundness = red ? 1.03 : .96;
    ellipsoid(materials.skin, [0, 0, .07], [.435 * roundness, .48, .39], head);
    for (const side of [-1, 1]) {
      ellipsoid(materials.skin, [side * .43, -.035, .055], [.085, .14, .08], head);
      ellipsoid(materials.ear, [side * .455, -.025, .107], [.041, .079, .028], head);
      ellipsoid(materials.cheek, [side * .26, -.13, .37], [.083, .043, .012], head);
    }
    ellipsoid(materials.skin, [0, -.045, .448], [.075, .063, .073], head);

    // Rafa has blue eyes; Leo has brown eyes. Both keep the small white catchlights.
    for (const side of [-1, 1]) {
      const x = side * .174;
      const eye = new T.Group(); eye.position.set(x, .095, .397); head.add(eye);
      eye.rotation.y = side * .12;
      ellipsoid(materials.eye, [0, 0, 0], [.132, .149, .064], eye);
      ellipsoid(materials.iris, [side * -.004, -.002, .052], [.084, .105, .027], eye);
      ellipsoid(materials.pupil, [side * -.004, -.002, .074], [.048, .074, .018], eye);
      ellipsoid(materials.light, [-.025, .038, .091], [.024, .026, .008], eye);
      tube([[x - .105, .267, .36], [x, .30 + (side < 0 ? .01 : 0), .395], [x + .101, .268, .36]], .025, materials.hair, head);
    }

    const mouth = new T.Shape();
    mouth.moveTo(-.17, 0);
    mouth.quadraticCurveTo(0, -.035, .17, 0);
    mouth.quadraticCurveTo(.13, red ? -.17 : -.14, 0, red ? -.175 : -.15);
    mouth.quadraticCurveTo(-.13, red ? -.17 : -.14, -.17, 0);
    const mouthMesh = mesh(new T.ShapeGeometry(mouth, 20), materials.mouth, [0, -.19, .43], null, head);
    mouthMesh.rotation.x = -.1;
    const teeth = new T.Shape();
    teeth.moveTo(-.127, -.017); teeth.quadraticCurveTo(0, -.047, .127, -.017);
    teeth.lineTo(.113, -.061); teeth.quadraticCurveTo(0, -.083, -.113, -.061); teeth.closePath();
    mesh(new T.ShapeGeometry(teeth, 16), materials.eye, [0, -.19, .434], null, head);
    ellipsoid(materials.tongue, [0, red ? -.322 : -.301, .434], [.075, .024, .009], head);

    // Sculpted cap and locks follow the reference: wavy/red and short/blue.
    mesh(new T.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, 1.10), materials.hair,
      [0, .035, .035], [.46, .50, .40], head);
    const locks = red ? [
      [-.34, .31, .26, -.55, .08, .20], [-.25, .37, .33, -.44, .08, .22],
      [-.12, .40, .365, -.38, .085, .24], [.02, .40, .38, .23, .09, .24],
      [.16, .39, .36, .40, .085, .21], [.29, .34, .30, .50, .08, .20],
      [-.25, .49, .12, -.7, .12, .19], [.04, .51, .18, .72, .12, .19],
    ] : [
      [-.34, .29, .28, -.28, .065, .145], [-.24, .32, .35, -.23, .07, .18],
      [-.12, .35, .385, -.16, .065, .18], [.005, .34, .395, .11, .07, .20],
      [.13, .36, .37, .27, .065, .17], [.25, .34, .32, .38, .075, .16],
      [.35, .28, .26, .38, .065, .145], [0, .47, .14, -.5, .12, .15],
    ];
    locks.forEach(([x, y, z, rotation, width, length], i) => {
      const lock = ellipsoid(i % 3 === 0 ? materials.hairLight : materials.hair, [x, y, z], [width, length, .05], head);
      lock.rotation.z = rotation;
      lock.rotation.x = -.14;
    });
    for (const side of [-1, 1]) {
      ellipsoid(materials.hair, [side * .392, .13, .035], [.065, .19, .135], head);
    }

    // Opaque rear shell and a very light clear bubble preserve readable faces.
    mesh(new T.SphereGeometry(1, 28, 20, Math.PI, Math.PI), materials.suit,
      [0, .98, .02], [.635, .67, .56]);
    ring(.60, .055, materials.suit, [0, .98, .08], [1, 1.07, 1]);
    ring(.637, .018, materials.accent, [0, .98, .078], [1, 1.07, 1]);
    for (const side of [-1, 1]) {
      ellipsoid(materials.accent, [side * .61, .98, .05], [.075, .12, .07]);
      ellipsoid(materials.suitShade, [side * .665, .98, .05], [.03, .075, .048]);
    }
    const visor = mesh(new T.SphereGeometry(1, 28, 20, 0, Math.PI), new T.MeshPhongMaterial({
      color: '#bce9ff', transparent: true, opacity: .055, shininess: 100,
      specular: '#ffffff', depthWrite: false, side: T.FrontSide,
    }), [0, .98, .02], [.635, .67, .56]);
    visor.renderOrder = 2;
    tube([[-.38, 1.43, .30], [-.46, 1.33, .34], [-.49, 1.22, .34]], .012,
      new T.MeshBasicMaterial({ color: '#d4f4ff', transparent: true, opacity: .65 }));

    // Non-enumerable joint references keep Object3D.toJSON() reusable.
    Object.defineProperty(astronaut.userData, 'joints', { value: joints, enumerable: false });
    animate(astronaut, 0, true);
    return astronaut;
  }

  function animate(model, seconds, reducedMotion = false) {
    const joints = model.userData.joints;
    if (!joints) return;
    const red = model.userData.variant === 'red';
    const t = reducedMotion ? 0 : seconds;
    const wave = Math.sin(t * 1.4 + (red ? 1.5 : 0));
    const drift = Math.sin(t * .7 + (red ? .5 : 2));
    joints.leftArm.rotation.z = (red ? -.85 : -.63) + (reducedMotion ? 0 : drift * .09);
    joints.leftArm.rotation.x = -.14;
    joints.rightArm.rotation.z = (red ? 2.20 : 1.95) + (reducedMotion ? 0 : wave * .12);
    joints.rightArm.rotation.x = -.16;
    joints.rightElbow.rotation.x = -.45 + (reducedMotion ? 0 : wave * .055);
    joints.leftLeg.rotation.z = -.17 + (reducedMotion ? 0 : drift * .035);
    joints.leftLeg.rotation.x = -.12;
    joints.rightLeg.rotation.z = .24 - (reducedMotion ? 0 : drift * .035);
    joints.rightLeg.rotation.x = .22;
    joints.head.rotation.z = red ? -.055 : .04;
    joints.head.rotation.y = reducedMotion ? 0 : Math.sin(t * .5) * .035;
  }

  return { create, animate };
});
