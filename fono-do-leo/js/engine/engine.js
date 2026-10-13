import { store } from '../store.js';
import { AudioEngine } from './audio.js';
import { FaceTracker, loadLandmarker } from './face.js';
import { TongueKnn } from './knn.js';
import { PoseState } from './poses.js';
import { playHooks } from './sfx.js';
import { DEV } from '../env.js';
import { openCamera, openTestSource } from './source.js';
import { speechHooks } from './speech.js';

/** App-wide singleton: camera + face tracker + pose scores + microphone. */
class Engine {
  src = null;
  tracker = null;
  poses = new PoseState();
  audio = new AudioEngine();
  knn = new TongueKnn();
  last = null;
  /** recent frames for speech checks (lips closed before a word, etc.) */
  history = [];
  fns = new Set();
  starting = null;
  stopTimer = 0;
  speaking = false;

  constructor() {
    this.knn.load();
    playHooks.onPlay = (ms) => this.audio.mute(ms + 150);
    speechHooks.onSpeaking = (on) => {
      this.speaking = on;
      if (on) this.audio.muteUntil = Infinity;
      else this.audio.muteUntil = performance.now() + 300;
    };
  }

  get isSpeaking() { return this.speaking; }
  get cameraOn() { return !!this.tracker; }

  onFrame(fn) {
    this.fns.add(fn);
    return () => { this.fns.delete(fn); };
  }

  applySettings() {
    const s = store.settings;
    this.audio.sens = s.sensSom;
    if (this.tracker) this.tracker.tongue.redFrac = Math.min(0.75, Math.max(0.3, 0.5 / s.sensLingua));
  }

  /** Loads the model (first time) and opens the camera. Safe to call repeatedly. */
  startCamera() {
    clearTimeout(this.stopTimer);
    if (this.tracker) return Promise.resolve();
    if (!this.starting) {
      this.starting = (async () => {
        // ?src=/caminho/foto.jpg replaces the camera while developing
        const asked = DEV ? new URLSearchParams(location.search).get('src') : null;
        const test = asked && new URL(asked, location.href).origin === location.origin ? asked : null;
        const [lm, src] = await Promise.all([loadLandmarker(), test ? openTestSource(test) : openCamera()]);
        this.src = src;
        this.tracker = new FaceTracker(lm, src);
        const rest = store.baseline ? store.loadRest() : null;
        if (rest && rest.L.length === this.tracker.tongue.L.length) this.tracker.tongue.rest = rest;
        this.applySettings();
        this.tracker.onFrame = (f) => this.handle(f);
        this.tracker.start();
      })().finally(() => { this.starting = null; });
    }
    return this.starting;
  }

  /** Release the camera a little after leaving the exercises (avoids re-prompting between screens). */
  releaseCameraSoon(ms = 45000) {
    clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(() => this.stopCamera(), ms);
  }

  stopCamera() {
    this.tracker?.stop();
    this.tracker = null;
    this.src?.stop();
    this.src = null;
    this.last = null;
    this.poses.reset();
  }

  async startMic() {
    this.applySettings();
    await this.audio.start();
  }

  stopMic() { this.audio.stop(); }

  handle(f) {
    this.last = f;
    this.poses.update(f, store.baseline, { labios: store.settings.sensLabios, lingua: store.settings.sensLingua }, this.knn.ready() ? this.knn : null);
    if (f.m) {
      const sm = ((f.bs.mouthSmileLeft ?? 0) + (f.bs.mouthSmileRight ?? 0)) / 2;
      this.history.push({ t: f.t, open: f.m.openIn, pucker: this.poses.score.bico, jaw: f.bs.jawOpen ?? 0, smile: sm });
      while (this.history.length && f.t - this.history[0].t > 4000) this.history.shift();
    }
    this.fns.forEach((fn) => fn(f, this.poses));
  }

  /** Face history between two performance.now() timestamps. */
  window(t0, t1) {
    return this.history.filter((h) => h.t >= t0 && h.t <= t1);
  }
}

export const engine = new Engine();
