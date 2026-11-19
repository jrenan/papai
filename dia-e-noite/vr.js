/* The same day/night model, arranged as a small, stationary WebXR science toy.
 * The globe is real 3D; the window renders the shared Taubaté garden scene.
 * No DOM overlay or headset-specific input API is required inside the headset.
 */
(function (root) {
  'use strict';
  const FONT = '"Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif';
  const COLORS = { space: '#101c39', paper: '#f8f6ed', ink: '#1a3155', pink: '#ec5c84', gold: '#ffcf63', green: '#176b57' };

  function create(options) {
    const T = options.THREE, M = root.DayNightModel;
    let renderer = null, scene = null, camera = null, content = null;
    let earth = null, earthTurn = null, marker = null, sun = null, gardenTarget = null, windowMesh = null, gardenCamera = null;
    let hud = null, instruction = null, mapTexture = null;
    let session = null, active = false, starting = false, disposed = false, entered = false;
    let generation = 0, supportCheck = 0, supported = false, anchored = false;
    let lastTime = 0, lastGarden = -Infinity, lastMap = -Infinity, lastMapVersion, lastHUD = '';
    let lastHUDAt = -Infinity, lastHUDPhase = '', lastPlaying = null, lastExplanation = '';
    let status = 'idle', ending = false, contextBroken = false;
    const targets = [], controllers = [], astronauts = [], ownedTextures = new Set();
    const phaseNames = { sunrise: 'Amanhecer', day: 'Dia', sunset: 'Entardecer', night: 'Noite' };
    const phaseCopy = {
      day: 'A luz do Sol chega a Taubaté.', sunset: 'Taubaté está saindo da luz.',
      night: 'Taubaté está virada para longe do Sol.', sunrise: 'Taubaté está voltando para a luz.',
    };
    const raycaster = new T.Raycaster(), rotationMatrix = new T.Matrix4();
    const point = new T.Vector3(), normal = new T.Vector3(), center = new T.Vector3();
    const quaternion = new T.Quaternion(), euler = new T.Euler(0, 0, 0, 'YXZ');

    function report(next, message) {
      status = next;
      if (!disposed) options.onStatus?.({ status: next, message });
    }
    function texture(width, height, paint) {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const map = new T.CanvasTexture(canvas); map.encoding = T.sRGBEncoding;
      map.minFilter = T.LinearFilter; map.generateMipmaps = false;
      ownedTextures.add(map);
      const item = { canvas, context: canvas.getContext('2d'), map };
      if (paint) paint(item.context, width, height);
      return item;
    }
    function rounded(c, x, y, w, h, radius) {
      c.beginPath(); c.moveTo(x + radius, y); c.lineTo(x + w - radius, y);
      c.quadraticCurveTo(x + w, y, x + w, y + radius); c.lineTo(x + w, y + h - radius);
      c.quadraticCurveTo(x + w, y + h, x + w - radius, y + h); c.lineTo(x + radius, y + h);
      c.quadraticCurveTo(x, y + h, x, y + h - radius); c.lineTo(x, y + radius);
      c.quadraticCurveTo(x, y, x + radius, y); c.closePath();
    }
    function text(c, value, x, y, size, color = COLORS.ink) {
      c.fillStyle = color; c.font = `700 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(value, x, y);
    }
    function plane(map, width, height, x, y, z, name) {
      const mesh = new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial({ map, transparent: true, toneMapped: false }));
      mesh.position.set(x, y, z); mesh.name = name || ''; content.add(mesh); return mesh;
    }
    function label(value, width, x, y, z, color = COLORS.paper) {
      const measure = document.createElement('canvas').getContext('2d');
      measure.font = `700 48px ${FONT}`;
      const pixels = Math.max(192, Math.ceil(measure.measureText(value).width + 64));
      const painted = texture(pixels, 112, c => text(c, value, pixels / 2, 56, 48, color));
      return plane(painted.map, width, width * 112 / pixels, x, y, z);
    }
    function icon(c, type, x, y, size, color) {
      c.save(); c.translate(x, y); c.scale(size / 48, size / 48);
      c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      if (type === 'day') {
        c.arc(0, 0, 10, 0, M.TAU); c.stroke();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * 17, Math.sin(a) * 17); c.lineTo(Math.cos(a) * 23, Math.sin(a) * 23); c.stroke(); }
      } else if (type === 'night') {
        for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 10 : 23; if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r); else c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.stroke();
      } else if (type === 'sunrise' || type === 'sunset') {
        c.moveTo(-23, 13); c.lineTo(23, 13); c.stroke(); c.beginPath(); c.arc(0, 12, 13, Math.PI, 0); c.stroke();
        c.beginPath(); c.moveTo(0, -11); c.lineTo(0, -24); c.moveTo(-20, -4); c.lineTo(-25, -9); c.moveTo(20, -4); c.lineTo(25, -9); c.stroke();
        c.beginPath(); const d = type === 'sunrise' ? 1 : -1; c.moveTo(-5, -18 + d * 4); c.lineTo(0, -18 - d * 2); c.lineTo(5, -18 + d * 4); c.stroke();
      } else if (type === 'pause') {
        c.fillRect(-14, -20, 9, 40); c.fillRect(5, -20, 9, 40);
      } else if (type === 'toggle') {
        c.moveTo(-13, -21); c.lineTo(21, 0); c.lineTo(-13, 21); c.closePath(); c.fill();
      } else if (type === 'reset') {
        c.arc(0, 0, 19, -.6, Math.PI * 1.65); c.stroke(); c.beginPath(); c.moveTo(18, -23); c.lineTo(18, -10); c.lineTo(5, -10); c.stroke();
      } else if (type === 'exit') {
        c.moveTo(-4, -22); c.lineTo(-20, -22); c.lineTo(-20, 22); c.lineTo(-4, 22); c.moveTo(-7, 0); c.lineTo(22, 0); c.moveTo(11, -11); c.lineTo(22, 0); c.lineTo(11, 11); c.stroke();
      }
      c.restore();
    }
    function button(action, value, title, x, y, width = .49) {
      const painted = texture(384, 300);
      const mesh = plane(painted.map, width, width * 300 / 384, x, y, -2.42, `vr-${value || action}`);
      mesh.userData = { action, value, title, painted, selected: false, hovered: false, playing: false };
      targets.push(mesh); paintButton(mesh); return mesh;
    }
    function paintButton(mesh) {
      const d = mesh.userData, { context: c, map } = d.painted;
      c.clearRect(0, 0, 384, 300);
      c.fillStyle = d.selected ? COLORS.green : d.hovered ? '#ffdf85' : COLORS.paper;
      rounded(c, 7, 7, 370, 286, 36); c.fill();
      if (d.hovered) { c.strokeStyle = '#ffffff'; c.lineWidth = 9; c.stroke(); }
      const color = d.selected ? '#ffffff' : COLORS.ink;
      icon(c, d.action === 'phase' ? d.value : d.action === 'toggle' && d.playing ? 'pause' : d.action, 192, 110, 87, color);
      text(c, d.action === 'toggle' && d.playing ? 'Pausar' : d.title, 192, 234, d.title.length > 10 ? 31 : 36, color);
      map.needsUpdate = true;
    }

    function build() {
      if (renderer) return;
      renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.outputEncoding = T.sRGBEncoding; renderer.localClippingEnabled = true;
      renderer.setPixelRatio(1); renderer.setSize(1024, 768, false);
      renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local');
      renderer.xr.setFramebufferScaleFactor(.85);
      const canvas = renderer.domElement;
      canvas.id = 'dayNightVRCanvas'; canvas.setAttribute('aria-label', 'Dia e noite em realidade virtual');
      canvas.style.cssText = 'display:none;position:fixed;inset:0;width:100%;height:100%;z-index:1000';
      document.body.append(canvas);
      canvas.addEventListener('webglcontextlost', onContextLost);
      scene = new T.Scene(); scene.background = new T.Color(COLORS.space);
      camera = new T.PerspectiveCamera(65, 4 / 3, .05, 50);
      content = new T.Group(); content.name = 'stationary-science-toy'; scene.add(content);

      const stars = [];
      for (let i = 0; i < 250; i++) {
        const a = i * 2.3999632297, y = 1 - 2 * (i + .5) / 250, r = Math.sqrt(1 - y * y);
        stars.push(Math.cos(a) * r * 18, y * 18, Math.sin(a) * r * 18);
      }
      const starGeometry = new T.BufferGeometry(); starGeometry.setAttribute('position', new T.Float32BufferAttribute(stars, 3));
      scene.add(new T.Points(starGeometry, new T.PointsMaterial({ color: '#dcecff', size: .035, sizeAttenuation: true })));
      content.add(new T.AmbientLight('#b4d2ff', .09));
      const light = new T.DirectionalLight('#fff3d2', 1.65);
      light.position.set(-6, .12, -2.8); light.target.position.set(-.7, .12, -2.8); content.add(light, light.target);

      earthTurn = new T.Group(); earthTurn.position.set(-.7, .12, -2.8); content.add(earthTurn);
      mapTexture = new T.CanvasTexture(options.mapCanvas); mapTexture.encoding = T.sRGBEncoding; ownedTextures.add(mapTexture);
      mapTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      earth = new T.Mesh(new T.SphereGeometry(.62, 48, 32), new T.MeshPhongMaterial({ map: mapTexture, shininess: 10, specular: '#23566e' }));
      earth.name = 'vr-earth'; earth.userData = { action: 'drag', radius: .62 }; earthTurn.add(earth); targets.push(earth);
      const city = M.geographicVector(M.location.latitude, M.location.longitude);
      const direction = new T.Vector3(city.x, city.y, city.z);
      marker = new T.Group(); marker.name = 'vr-taubate'; marker.position.copy(direction).multiplyScalar(.625);
      marker.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction); earthTurn.add(marker);
      const stem = new T.Mesh(new T.CylinderGeometry(.008, .008, .09, 8), new T.MeshBasicMaterial({ color: '#ffffff' })); stem.position.y = .045; marker.add(stem);
      const pin = new T.Mesh(new T.SphereGeometry(.036, 12, 10), new T.MeshBasicMaterial({ color: COLORS.pink })); pin.position.y = .1; marker.add(pin);
      const ring = new T.Mesh(new T.TorusGeometry(.052, .008, 6, 24), new T.MeshBasicMaterial({ color: '#ffffff' })); ring.rotation.x = Math.PI / 2; marker.add(ring);
      const axis = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-.7, -.66, -2.8), new T.Vector3(-.7, .9, -2.8)]), new T.LineDashedMaterial({ color: '#8fa6c6', dashSize: .035, gapSize: .04 }));
      axis.computeLineDistances(); content.add(axis);

      sun = new T.Mesh(new T.SphereGeometry(.18, 24, 16), new T.MeshBasicMaterial({ color: '#ffe68b' }));
      sun.name = 'vr-fixed-sun'; sun.position.set(-2.1, .12, -2.8); content.add(sun);
      const glow = texture(128, 128, c => { const g = c.createRadialGradient(64, 64, 15, 64, 64, 64); g.addColorStop(0, '#ffdf9780'); g.addColorStop(1, '#ffcc6600'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
      const corona = new T.Sprite(new T.SpriteMaterial({ map: glow.map, transparent: true, depthWrite: false })); corona.position.copy(sun.position); corona.scale.set(.95, .95, 1); content.add(corona);
      for (const y of [-.13, .12, .37]) {
        const arrow = new T.ArrowHelper(new T.Vector3(1, 0, 0), new T.Vector3(-1.85, y, -2.8), .43, '#ffe8a5', .07, .035); content.add(arrow);
      }
      label('Sol', .42, -2.1, -.17, -2.78, '#ffe8a5');
      label('Gire a Terra', 1.1, -.7, .99, -2.8);
      label('O ponto rosa é Taubaté', 1.35, -.7, -.68, -2.8);
      label('O Sol fica parado. A Terra gira.', 2.9, -.12, 1.38, -3.05);

      for (const [index, name, variant] of [[0, 'Leo', 'blue'], [1, 'Rafa', 'red']]) {
        const model = root.TrioAstronauts.create(T, { name, variant });
        const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3());
        model.position.sub(bounds.getCenter(new T.Vector3()));
        const holder = new T.Group(); holder.add(model); holder.scale.setScalar(.57 / size.y);
        holder.position.set(-1.87, index ? -.67 : .89, -2.8); holder.rotation.z = index ? .1 : -.1; content.add(holder);
        astronauts.push({ holder, model, y: holder.position.y });
        label(name, .35, -1.87, holder.position.y - .36, -2.76);
      }

      gardenTarget = new T.WebGLRenderTarget(768, 512, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true, stencilBuffer: false });
      gardenTarget.texture.encoding = T.sRGBEncoding;
      gardenCamera = options.gardenCamera.clone(); gardenCamera.aspect = 1.5; gardenCamera.updateProjectionMatrix();
      const frame = new T.Mesh(new T.BoxGeometry(1.64, 1.14, .06), new T.MeshBasicMaterial({ color: COLORS.paper })); frame.position.set(1.05, .1, -2.91); content.add(frame);
      windowMesh = plane(gardenTarget.texture, 1.56, 1.04, 1.05, .1, -2.87, 'vr-taubate-window');
      hud = texture(1024, 250);
      plane(hud.map, 1.64, .4, 1.05, .89, -2.87, 'vr-taubate-clock');
      instruction = texture(1024, 112);
      plane(instruction.map, 1.78, .2, 1.05, -.59, -2.86, 'vr-phase-explanation');
      const mark = new T.Mesh(new T.CircleGeometry(.024, 20), new T.MeshBasicMaterial({ color: COLORS.pink })); mark.position.set(.33, .53, -2.86); content.add(mark);

      for (const [index, phase] of ['sunrise', 'day', 'sunset', 'night'].entries()) button('phase', phase, phaseNames[phase], -.82 + index * .55, -1.02);
      button('toggle', null, 'Girar', -.63, -1.49, .58);
      button('reset', null, 'Recomeçar', 0, -1.49, .58);
      button('exit', null, 'Sair', .63, -1.49, .58);
      label('Aponte e aperte. Segure a Terra para girar.', 2.65, 0, -1.92, -2.42, '#d8e9ff');

      for (let index = 0; index < 2; index++) {
        const controller = renderer.xr.getController(index);
        const beam = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(0, 0, -1)]), new T.LineBasicMaterial({ color: '#ffdc82', transparent: true, opacity: .8 }));
        beam.scale.z = 3; controller.add(beam);
        const cursor = new T.Mesh(new T.SphereGeometry(.011, 8, 6), new T.MeshBasicMaterial({ color: '#ffffff', depthTest: false })); cursor.visible = false; cursor.renderOrder = 10; scene.add(cursor);
        controller.userData.beam = beam; controller.userData.cursor = cursor;
        controller.addEventListener('connected', event => { controller.userData.source = event.data; });
        controller.addEventListener('disconnected', () => { controller.userData.source = null; controller.userData.drag = null; cursor.visible = false; });
        controller.addEventListener('selectstart', () => startSelect(controller));
        controller.addEventListener('selectend', () => { controller.userData.drag = null; });
        controllers.push(controller); scene.add(controller);
      }
      updateScene(0);
    }

    function controllerRay(controller) {
      controller.updateWorldMatrix(true, false);
      rotationMatrix.extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotationMatrix).normalize();
      return raycaster;
    }
    function hit(controller) {
      scene.updateMatrixWorld(true);
      return controllerRay(controller).intersectObjects(targets, false)[0] || null;
    }
    function executeAction(action, value) {
      if (!active || session?.visibilityState === 'hidden' || disposed) return;
      if (action === 'exit') { void exit(); return; }
      if (action === 'phase' && !Object.prototype.hasOwnProperty.call(M.targets, value)) return;
      if (action === 'angle' && !Number.isFinite(value)) return;
      if (['angle', 'phase', 'toggle', 'reset', 'pause'].includes(action)) options.onAction?.(action, value);
    }
    function startSelect(controller) {
      if (!active || session?.visibilityState === 'hidden') return;
      const intersection = hit(controller); if (!intersection) return;
      const target = intersection.object, data = target.userData;
      if (data.action === 'drag') {
        executeAction('pause'); // Stop automatic/tween motion before taking hold.
        earthTurn.getWorldPosition(center); content.getWorldQuaternion(quaternion);
        normal.set(0, 0, 1).applyQuaternion(quaternion);
        const dragPlane = new T.Plane().setFromNormalAndCoplanarPoint(normal, center);
        if (controllerRay(controller).ray.intersectPlane(dragPlane, point)) {
          controller.userData.drag = { plane: dragPlane, x: content.worldToLocal(point.clone()).x };
        }
      } else executeAction(data.action, data.value);
      const actuator = controller.userData.source?.gamepad?.hapticActuators?.[0];
      try { const pulse = actuator?.pulse(.12, 35); pulse?.catch?.(() => {}); } catch (_) { /* Optional controller feedback. */ }
    }
    function updateInput(dt) {
      const hovered = new Set();
      for (const controller of controllers) {
        const data = controller.userData;
        if (!controller.visible) { data.drag = null; data.cursor.visible = false; continue; }
        if (data.drag && controllerRay(controller).ray.intersectPlane(data.drag.plane, point)) {
          const x = content.worldToLocal(point.clone()).x;
          executeAction('angle', Math.max(-.22, Math.min(.22, (x - data.drag.x) / .62)));
          data.drag.x = x;
        }
        const intersection = hit(controller);
        data.beam.scale.z = intersection ? intersection.distance : 3;
        data.cursor.visible = Boolean(intersection);
        if (intersection) { data.cursor.position.copy(intersection.point); hovered.add(intersection.object); }
      }
      for (const target of targets) {
        if (!target.userData.painted) continue;
        const value = hovered.has(target);
        if (value !== target.userData.hovered) { target.userData.hovered = value; paintButton(target); }
      }
      let axis = 0;
      for (const source of session?.inputSources || []) {
        const axes = source.gamepad?.axes;
        if (!axes?.length) continue;
        const x = axes.length >= 4 ? axes[2] : axes[0];
        if (Math.abs(x) > Math.abs(axis)) axis = x;
      }
      if (Math.abs(axis) > .2 && dt > 0) executeAction('angle', Math.sign(axis) * (Math.abs(axis) - .2) / .8 * dt * 1.25);
    }
    function updateScene(time) {
      const snapshot = options.getState(), state = snapshot.state || M.getState(snapshot.angle);
      earthTurn.rotation.y = M.earthRotation(snapshot.angle);
      for (const [index, astronaut] of astronauts.entries()) {
        const seconds = snapshot.crewTime || 0;
        astronaut.holder.position.y = astronaut.y + (snapshot.crewMoving ? Math.sin(seconds * .6 + index * 2) * .025 : 0);
        root.TrioAstronauts.animate(astronaut.model, seconds, !snapshot.crewMoving);
        root.TrioAstronauts.lookAt(astronaut.model, .4, index ? .3 : -.3);
      }
      const key = `${state.phase}|${state.localTime}|${snapshot.playing}`;
      const immediate = state.phase !== lastHUDPhase || Boolean(snapshot.playing) !== lastPlaying;
      if (lastHUD !== key && (immediate || time - lastHUDAt >= 100)) {
        lastHUD = key; lastHUDAt = time; lastHUDPhase = state.phase; lastPlaying = Boolean(snapshot.playing);
        const c = hud.context; c.clearRect(0, 0, 1024, 250); c.fillStyle = COLORS.paper; rounded(c, 0, 0, 1024, 250, 36); c.fill();
        text(c, 'Taubaté', 235, 76, 54); text(c, state.localTime, 235, 160, 83);
        icon(c, state.phase, 615, 92, 81, COLORS.ink); text(c, phaseNames[state.phase], 806, 92, 48);
        text(c, 'Na experiência', 720, 185, 34); hud.map.needsUpdate = true;
        if (lastExplanation !== state.phase) {
          lastExplanation = state.phase;
          const i = instruction.context; i.clearRect(0, 0, 1024, 112); text(i, phaseCopy[state.phase], 512, 56, 39, '#ffffff'); instruction.map.needsUpdate = true;
        }
        for (const target of targets) {
          if (!target.userData.painted) continue;
          const selected = target.userData.action === 'phase' && target.userData.value === state.phase;
          if (selected !== target.userData.selected || target.userData.playing !== Boolean(snapshot.playing)) {
            target.userData.selected = selected; target.userData.playing = Boolean(snapshot.playing); paintButton(target);
          }
        }
      }
      // The geographical canvas is painted asynchronously once after page load.
      const mapVersion = options.getMapVersion?.();
      if (mapVersion !== lastMapVersion || lastMap === -Infinity || (!options.getMapVersion && time - lastMap > 3000)) {
        mapTexture.needsUpdate = true; lastMap = time; lastMapVersion = mapVersion;
      }
    }
    function anchor(frame) {
      if (anchored || !frame?.getViewerPose) return;
      const reference = renderer.xr.getReferenceSpace(); if (!reference) return;
      const pose = frame.getViewerPose(reference); if (!pose) return;
      const { position, orientation } = pose.transform;
      content.position.set(position.x, position.y, position.z);
      quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
      euler.setFromQuaternion(quaternion, 'YXZ'); content.rotation.y = euler.y;
      anchored = true;
    }
    function drawGarden() {
      const previousTarget = renderer.getRenderTarget(), xrEnabled = renderer.xr.enabled;
      try {
        renderer.xr.enabled = false;
        renderer.setRenderTarget(gardenTarget);
        renderer.render(options.gardenScene, gardenCamera);
      } finally {
        renderer.setRenderTarget(previousTarget); renderer.xr.enabled = xrEnabled;
      }
    }
    function frame(time, xrFrame) {
      if (!active || !session || disposed) return;
      try {
        const dt = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0; lastTime = time;
        anchor(xrFrame);
        if (!session.visibilityState || session.visibilityState === 'visible') {
          updateInput(dt); options.onFrame?.(time, 1.5);
        }
        updateScene(time);
        if (time - lastGarden >= 1000 / 15) { drawGarden(); lastGarden = time; }
        renderer.render(scene, camera);
      } catch (error) {
        console.warn('Dia e noite VR:', error);
        void fail('A imagem VR foi interrompida. Saia e toque em Entrar em VR para tentar de novo.');
      }
    }

    async function checkSupport() {
      if (disposed || active || starting) return supported;
      const check = ++supportCheck;
      if (root.isSecureContext === false) { supported = false; report('unsupported', 'Abra o endereço HTTPS do Trio do Saber no navegador dos óculos.'); return false; }
      if (!navigator.xr?.isSessionSupported) { supported = false; report('unsupported', 'Para entrar em VR, abra esta página no navegador dos óculos, como o Meta Quest.'); return false; }
      report('checking', 'Verificando os óculos…');
      try {
        const available = await navigator.xr.isSessionSupported('immersive-vr');
        if (check !== supportCheck || disposed || active || starting) return available;
        supported = available;
        report(available ? 'ready' : 'unsupported', available ? 'Aponte com o controle e aperte o gatilho. Segure a Terra para girar.' : 'Este navegador não liberou VR. Abra esta página no navegador dos óculos.');
        return available;
      } catch (_) {
        if (check === supportCheck && !disposed && !active && !starting) report('error', 'Não foi possível verificar o VR. Toque em Tentar novamente.');
        return false;
      }
    }
    function cleanSession(target) {
      if (session !== target) return;
      const notifyExit = entered;
      session = null; active = false; starting = false; entered = false; ending = false;
      renderer?.setAnimationLoop(null);
      if (renderer) renderer.domElement.style.display = 'none';
      for (const controller of controllers) { controller.userData.drag = null; controller.userData.cursor.visible = false; }
      target.removeEventListener('end', onEnd); target.removeEventListener('visibilitychange', onVisibility);
      lastTime = 0; anchored = false;
      if (notifyExit) options.onExit?.();
      if (contextBroken) { destroyGraphics(); contextBroken = false; }
      if (!disposed) report('ready', 'Você saiu do VR. Pode continuar na tela ou entrar de novo.');
    }
    function onEnd(event) { cleanSession(event.target || session); }
    function onVisibility() {
      lastTime = 0;
      if (session?.visibilityState !== 'visible') {
        options.onAction?.('pause');
        for (const controller of controllers) controller.userData.drag = null;
      }
    }
    async function enter() {
      if (disposed || starting) return false;
      if (active) return true;
      if (root.isSecureContext === false || !navigator.xr?.requestSession) { await checkSupport(); return false; }
      const request = ++generation; ++supportCheck;
      starting = true; report('starting', 'Confirme a entrada em VR nos óculos…');
      let acquired = null;
      try {
        // Keep this request in the click's user-activation stack.
        acquired = await navigator.xr.requestSession('immersive-vr');
        if (disposed || request !== generation) { await acquired.end(); return false; }
        session = acquired; session.addEventListener('end', onEnd); session.addEventListener('visibilitychange', onVisibility);
        build();
        await renderer.xr.setSession(session);
        if (disposed || request !== generation || session !== acquired) { try { await acquired.end(); } catch (_) {} return false; }
        supported = true; starting = false; active = true; entered = true;
        lastTime = 0; lastGarden = -Infinity; lastMap = -Infinity; lastHUD = ''; lastHUDAt = -Infinity; anchored = false;
        content.position.set(0, 0, 0); content.rotation.set(0, 0, 0);
        options.onEnter?.(); renderer.domElement.style.display = 'block';
        renderer.setAnimationLoop(frame);
        report('active', 'Você está no VR. Use Sair no painel para voltar.');
        return true;
      } catch (error) {
        if (acquired) {
          try { await acquired.end(); } catch (_) {}
          cleanSession(acquired);
          // An interrupted build/XR binding can leave a half-initialized renderer.
          // Recreate it on retry rather than reusing that partial state.
          destroyGraphics();
        }
        if (request !== generation || disposed) return false;
        starting = false;
        const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
        report('error', denied ? 'A entrada em VR não foi autorizada. Toque em Tentar novamente e permita a experiência nos óculos.' : 'Não foi possível iniciar o VR. Toque em Tentar novamente; se continuar, recarregue a página nos óculos.');
        return false;
      }
    }
    async function exit() {
      if (starting && !session) { ++generation; starting = false; report('ready', 'Entrada em VR cancelada.'); return; }
      if (!session || ending) return;
      ending = true; const current = session;
      try { await current.end(); cleanSession(current); }
      catch (_) { ending = false; report('error', 'Use o menu dos óculos para sair do VR e tente novamente.'); }
    }
    async function fail(message) {
      if (ending) return;
      await exit();
      if (contextBroken && !session) { destroyGraphics(); contextBroken = false; }
      if (!disposed) report('error', message);
    }
    function onContextLost(event) {
      event.preventDefault(); contextBroken = true;
      if (session || starting) void fail('A imagem VR foi interrompida. Toque em Tentar novamente para reabrir.');
      else {
        destroyGraphics(); contextBroken = false;
        report('error', 'A imagem VR foi interrompida. Toque em Tentar novamente para reabrir.');
      }
    }
    function onPageHide() { void exit(); }
    function destroyGraphics() {
      if (!renderer) return;
      renderer.setAnimationLoop(null);
      scene?.traverse(object => {
        object.geometry?.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material?.dispose();
      });
      // Astronaut matcaps are shared with the page; only dispose textures we own.
      ownedTextures.forEach(map => map.dispose()); ownedTextures.clear(); gardenTarget?.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.remove(); renderer.dispose();
      renderer = scene = camera = content = earth = earthTurn = marker = sun = gardenTarget = windowMesh = gardenCamera = null;
      lastExplanation = ''; lastHUD = ''; lastHUDAt = -Infinity;
      targets.length = controllers.length = astronauts.length = 0;
    }
    async function dispose() {
      if (disposed) return;
      disposed = true; ++generation; ++supportCheck;
      root.removeEventListener('pagehide', onPageHide);
      navigator.xr?.removeEventListener?.('devicechange', checkSupport);
      await exit(); destroyGraphics();
    }
    root.addEventListener('pagehide', onPageHide);
    navigator.xr?.addEventListener?.('devicechange', checkSupport);
    return {
      checkSupport, enter, exit, dispose,
      isActive: () => active, isStarting: () => starting,
      getDebugState: () => ({ renderer, scene, camera, content, controllers: [...controllers], targets: [...targets], earth, marker, sun, windowMesh, session, active, starting, status }),
    };
  }
  root.DayNightVR = { create };
})(window);
