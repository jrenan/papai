/* BASE_URL=http://127.0.0.1:8000 BROWSER=chromium node tests/day-night-vr.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const qaDirectory = process.env.QA_DIR || '/tmp/trio-day-night-vr-qa';

// This runtime deliberately supplies no headset pose or stereo projection.
// A real desktop renderer and actual controller rays exercise the application;
// only permission/session lifecycle and the XR frame clock are substituted.
function installRuntime() {
  const runtime = window.__vrRuntime = {
    supported: true, supportError: false, requestMode: 'success', attachMode: 'success',
    requests: [], sessions: [], renderers: [], loops: new Map(), pending: [], time: 1000,
    tick(count = 1) {
      for (let index = 0; index < count; index++) {
        this.time += 16;
        for (const callback of [...this.loops.values()]) callback(this.time, null);
      }
    },
  };
  const system = new EventTarget();
  system.isSessionSupported = async mode => {
    if (runtime.supportError) throw new Error('simulated support failure');
    return mode === 'immersive-vr' && runtime.supported;
  };
  system.requestSession = (mode, options) => {
    runtime.requests.push({ mode, options });
    if (runtime.requestMode === 'deny') {
      return Promise.reject(new DOMException('Permission declined for this test', 'NotAllowedError'));
    }
    const session = new EventTarget();
    session.visibilityState = 'visible';
    session.inputSources = [];
    session.endCount = 0;
    session.end = async () => {
      session.endCount++;
      if (!session.ended) { session.ended = true; session.dispatchEvent(new Event('end')); }
    };
    runtime.sessions.push(session);
    if (runtime.requestMode === 'pending') return new Promise(resolve => runtime.pending.push(() => resolve(session)));
    return Promise.resolve(session);
  };
  Object.defineProperty(navigator, 'xr', { configurable: true, value: system });
}

// App integration stays private in production; capture its factory only in this
// test response so we can inspect the shared model and dispatch controller rays.
function captureFactory() {
  const originalCreate = window.DayNightVR.create;
  window.DayNightVR.create = options => {
    const runtime = window.__vrRuntime;
    if (runtime) {
      const OriginalRenderer = options.THREE.WebGLRenderer;
      options.THREE.WebGLRenderer = function (...args) {
        const renderer = new OriginalRenderer(...args);
        runtime.renderers.push(renderer);
        renderer.xr.setSession = async session => {
          if (runtime.attachMode === 'fail') throw new Error('simulated XR attachment failure');
          renderer.__mockSession = session;
        };
        renderer.xr.getSession = () => renderer.__mockSession || null;
        renderer.setAnimationLoop = callback => {
          if (callback) runtime.loops.set(renderer, callback);
          else runtime.loops.delete(renderer);
        };
        return renderer;
      };
      options.THREE.WebGLRenderer.prototype = OriginalRenderer.prototype;
    }
    window.__vrBridge = options;
    window.__vrStatuses = [];
    const onStatus = options.onStatus;
    options.onStatus = state => { window.__vrStatuses.push(state); onStatus?.(state); };
    const api = originalCreate(options);
    window.__vrAPI = api;
    return api;
  };
}

async function newPage(browser, mocked = true, viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (mocked) await page.addInitScript(installRuntime);
  else await page.addInitScript(() => Object.defineProperty(navigator, 'xr', { configurable: true, value: undefined }));
  await page.route('**/dia-e-noite/vr.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\n;(${captureFactory.toString()})();` });
  });
  await page.goto(`${baseURL}/dia-e-noite/`);
  await page.waitForFunction(() => Boolean(window.__vrAPI));
  return { page, errors };
}

async function verify(engine, name) {
  const browser = await engine.launch({ headless: true });
  try {
    const unsupported = await newPage(browser, false, { width: 390, height: 844 });
    await unsupported.page.waitForFunction(() => window.__vrStatuses.some(state => state.status === 'unsupported'));
    assert.equal(await unsupported.page.locator('#enterVRButton').isDisabled(), true, 'a browser without WebXR cannot start a headset session');
    assert.ok((await unsupported.page.locator('#vrStatus').textContent()).trim().length > 15, 'unsupported VR includes a readable explanation');
    assert.equal(await unsupported.page.locator('#vrHelp').isVisible(), true, 'opening instructions remain available without WebXR');
    await unsupported.page.locator('#freeExplore').click();
    await unsupported.page.locator('button[data-phase="night"]').click();
    assert.equal(await unsupported.page.locator('#localTime').textContent(), '00:00', 'the regular experience still works without VR');
    assert.deepEqual(unsupported.errors, []);
    await unsupported.page.close();

    const { page, errors } = await newPage(browser);
    const run = callback => page.evaluate(callback);
    const state = () => run(() => {
      const shared = __vrBridge.getState();
      return { angle: shared.angle, playing: shared.playing, time: shared.state.localTime, phase: shared.state.phase };
    });
    await page.waitForFunction(() => window.__vrStatuses.some(item => item.status === 'ready'));
    assert.equal(await page.locator('#enterVRButton').isEnabled(), true);
    assert.equal(await run(() => __vrRuntime.renderers.length), 0, 'VR does not allocate a third graphics context before entry');

    await run(async () => { __vrRuntime.supported = false; await __vrAPI.checkSupport(); });
    assert.equal(await page.locator('#enterVRButton').isDisabled(), true, 'WebXR without an immersive device remains unavailable');
    await run(async () => { __vrRuntime.supported = true; await __vrAPI.checkSupport(); });
    assert.equal(await page.locator('#enterVRButton').isEnabled(), true, 'a newly available headset can be detected');

    await run(async () => { __vrRuntime.supportError = true; await __vrAPI.checkSupport(); });
    assert.ok((await page.locator('#vrStatus').textContent()).trim().length > 15, 'support check errors are explained');
    await run(async () => { __vrRuntime.supportError = false; await __vrAPI.checkSupport(); });
    assert.equal(await page.locator('#enterVRButton').isEnabled(), true, 'support can be checked again after a transient failure');

    await run(() => { __vrRuntime.requestMode = 'deny'; });
    await page.locator('#enterVRButton').click();
    await page.waitForFunction(() => window.__vrStatuses.at(-1)?.status === 'error');
    assert.equal(await run(() => __vrAPI.isActive()), false);
    assert.equal(await page.locator('#enterVRButton').isEnabled(), true, 'permission denial permits another deliberate try');
    assert.equal(await page.locator('body').getAttribute('data-lesson-active'), 'true', 'denied entry preserves the guided activity');

    await run(() => { __vrRuntime.requestMode = 'success'; __vrRuntime.attachMode = 'fail'; });
    await page.locator('#enterVRButton').click();
    await page.waitForFunction(() => __vrRuntime.sessions.at(-1)?.endCount === 1 && !__vrAPI.isStarting());
    assert.equal(await run(() => __vrAPI.isActive()), false, 'renderer setup failure restores regular mode');
    assert.equal(await page.locator('#enterVRButton').isEnabled(), true);

    const requestsBefore = await run(() => __vrRuntime.requests.length);
    await run(() => {
      __vrRuntime.attachMode = 'success'; __vrRuntime.requestMode = 'pending';
      document.querySelector('#enterVRButton').click();
      __vrAPI.enter();
    });
    assert.equal(await run(() => __vrRuntime.requests.length), requestsBefore + 1, 'repeated entry while permission is pending requests one session');
    assert.equal(await run(() => __vrAPI.isStarting()), true);
    await run(() => { __vrRuntime.pending.shift()(); });
    await page.waitForFunction(() => __vrAPI.isActive());
    assert.equal(await page.locator('body').getAttribute('data-lesson-active'), 'false', 'VR uses unlocked exploration controls');
    assert.equal((await state()).playing, false, 'entry starts with a still Earth');
    assert.equal(await run(() => __vrRuntime.renderers.filter(renderer => renderer.domElement.isConnected).length), 1, 'failed graphics setup leaves only the recovered VR canvas attached');
    const graphicsCount = await run(() => __vrRuntime.renderers.length);
    await run(() => {
      const debug = __vrAPI.getDebugState();
      window.__vrInput = { handedness: 'right', targetRayMode: 'tracked-pointer', gamepad: { axes: [0, 0, 0, 0], buttons: [] } };
      __vrRuntime.sessions.at(-1).inputSources = [__vrInput];
      debug.controllers[0].visible = true; // A physical XR frame normally supplies tracking visibility.
      debug.controllers[0].dispatchEvent({ type: 'connected', data: __vrInput });
      window.__pointVR = target => {
        const debug = __vrAPI.getDebugState();
        debug.scene.updateMatrixWorld(true);
        const controller = debug.controllers[0];
        controller.position.set(0, 0, 0);
        controller.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), target.clone().sub(controller.position).normalize());
        controller.updateMatrix(); // WebXR target-ray groups disable matrixAutoUpdate.
        controller.updateMatrixWorld(true);
      };
      window.__pressVR = (action, value) => {
        const debug = __vrAPI.getDebugState();
        const target = debug.targets.find(mesh => mesh.userData.action === action && (value === undefined || mesh.userData.value === value));
        if (!target) throw new Error(`Missing VR target: ${action} ${value}`);
        debug.scene.updateMatrixWorld(true);
        __pointVR(target.getWorldPosition(new THREE.Vector3()));
        debug.controllers[0].dispatchEvent({ type: 'selectstart' });
        debug.controllers[0].dispatchEvent({ type: 'selectend' });
        __vrRuntime.tick(2);
      };
      __vrRuntime.tick(2);
    });

    const sceneFacts = await run(() => {
      const debug = __vrAPI.getDebugState();
      const expected = DayNightModel.geographicVector(DayNightModel.location.latitude, DayNightModel.location.longitude);
      const marker = debug.marker.position.clone().normalize();
      return {
        markerError: marker.distanceTo(new THREE.Vector3(expected.x, expected.y, expected.z)),
        hasGarden: Boolean(debug.windowMesh?.material?.map),
        actions: debug.targets.map(target => target.userData.action),
      };
    });
    assert.ok(sceneFacts.markerError < 1e-6, 'the VR marker uses the actual Taubaté coordinates');
    assert.equal(sceneFacts.hasGarden, true, 'VR contains a live view of the same garden');
    assert.ok(sceneFacts.actions.includes('drag') && sceneFacts.actions.includes('exit'), 'globe interaction and headset exit both exist in 3D');
    const fixedSun = await run(() => __vrAPI.getDebugState().sun.position.toArray());

    for (const [phase, time] of [['night', '00:00'], ['sunrise', '06:00'], ['sunset', '18:00'], ['day', '12:00']]) {
      await page.evaluate(([action, value]) => __pressVR(action, value), ['phase', phase]);
      assert.equal((await state()).time, time, `VR ${phase} keeps the shared 24-hour clock in sync`);
      assert.equal(await page.locator('#localTime').textContent(), time, 'the normal view receives the same simulation state');
    }
    assert.deepEqual(await run(() => __vrAPI.getDebugState().sun.position.toArray()), fixedSun, 'changing the moment rotates Earth while the Sun stays fixed');
    assert.equal(await run(() => __vrAPI.getDebugState().renderer.xr.enabled), true, 'offscreen garden rendering restores the XR rendering mode');
    await run(() => __pressVR('toggle'));
    assert.equal((await state()).playing, true, 'controller ray starts the shared rotation');
    await run(() => __vrRuntime.tick(12));
    assert.ok((await state()).angle > 0, 'the XR frame loop advances the shared Earth');
    await run(() => __pressVR('toggle'));
    const paused = (await state()).angle;
    await run(() => __vrRuntime.tick(12));
    assert.equal((await state()).angle, paused, 'the VR pause button stops the Earth');

    const beforeStick = (await state()).angle;
    await run(() => { __vrInput.gamepad.axes[2] = 0.8; __vrRuntime.tick(12); __vrInput.gamepad.axes[2] = 0; });
    assert.notEqual((await state()).angle, beforeStick, 'a controller thumbstick rotates the shared globe');
    await run(() => __pressVR('reset'));
    assert.equal((await state()).time, '12:00');
    const beforeDrag = (await state()).angle;
    await run(() => {
      const debug = __vrAPI.getDebugState();
      debug.scene.updateMatrixWorld(true);
      const target = debug.targets.find(mesh => mesh.userData.action === 'drag').getWorldPosition(new THREE.Vector3());
      __pointVR(target);
      debug.controllers[0].dispatchEvent({ type: 'selectstart' });
      target.x += 0.3;
      __pointVR(target);
      __vrRuntime.tick(2);
      debug.controllers[0].dispatchEvent({ type: 'selectend' });
    });
    assert.notEqual((await state()).angle, beforeDrag, 'holding the trigger and moving the controller ray turns the Earth');
    const afterDrag = (await state()).angle;
    await run(() => __vrRuntime.tick(12));
    assert.equal((await state()).angle, afterDrag, 'releasing the trigger does not leave the globe spinning');

    fs.mkdirSync(qaDirectory, { recursive: true });
    const preview = await run(() => {
      const debug = __vrAPI.getDebugState();
      debug.renderer.setSize(1440, 900, false);
      debug.camera.aspect = 1440 / 900; debug.camera.updateProjectionMatrix();
      __vrRuntime.tick(2);
      return debug.renderer.domElement.toDataURL('image/png');
    });
    fs.writeFileSync(path.join(qaDirectory, `${name.toLowerCase()}-vr-desktop-preview.png`), Buffer.from(preview.split(',')[1], 'base64'));

    await run(() => __pressVR('toggle'));
    await run(() => {
      const session = __vrRuntime.sessions.at(-1);
      session.visibilityState = 'hidden'; session.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal((await state()).playing, false, 'hiding the headset pauses the shared simulation');
    await run(() => {
      const session = __vrRuntime.sessions.at(-1);
      session.visibilityState = 'visible'; session.dispatchEvent(new Event('visibilitychange'));
      __pressVR('exit');
    });
    await page.waitForFunction(() => !__vrAPI.isActive());
    assert.equal(await run(() => __vrRuntime.loops.size), 0, 'leaving VR stops the XR render loop');
    assert.equal((await state()).playing, false, 'leaving VR keeps the Earth paused');
    await page.locator('button[data-phase="night"]').click();
    assert.equal(await page.locator('#localTime').textContent(), '00:00', 'normal controls work after returning from VR');

    await run(() => { __vrRuntime.requestMode = 'success'; });
    await page.locator('#enterVRButton').click();
    await page.waitForFunction(() => __vrAPI.isActive());
    await run(() => __vrRuntime.sessions.at(-1).end());
    await page.waitForFunction(() => !__vrAPI.isActive());
    assert.equal(await page.locator('#enterVRButton').isEnabled(), true, 'ending from the headset allows a new entry');
    assert.equal(await run(() => __vrRuntime.renderers.length), graphicsCount, 'reentry after a normal exit reuses its graphics context');

    await run(() => { __vrRuntime.requestMode = 'pending'; });
    await page.locator('#enterVRButton').click();
    await page.waitForFunction(() => __vrAPI.isStarting());
    await run(() => { window.dispatchEvent(new Event('pagehide')); __vrRuntime.pending.shift()(); });
    await page.waitForFunction(() => __vrRuntime.sessions.at(-1).endCount === 1);
    assert.equal(await run(() => __vrAPI.isActive()), false, 'a permission result arriving after page exit cannot enter VR');
    assert.equal(await run(() => __vrRuntime.loops.size), 0, 'canceled pending entry leaves no frame loop');
    assert.deepEqual(errors, [], 'the VR entry, raycast controls and exit have no uncaught browser errors');
    console.log(`PASS ${name} VR: unavailable/denied/retry, setup cleanup, duplicate entry, Taubaté, shared clock, controller rays, drag, thumbstick, pause and exit (mock XR lifecycle; no physical headset)`);
    await page.close();
  } finally { await browser.close(); }
}

(async () => {
  if (!process.env.BROWSER || process.env.BROWSER === 'chromium') await verify(chromium, 'Chromium');
  if (!process.env.BROWSER || process.env.BROWSER === 'webkit') await verify(webkit, 'WebKit');
})().catch(error => { console.error(error); process.exitCode = 1; });
