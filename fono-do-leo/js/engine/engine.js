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
  captureMic = false;
  micGeneration = 0;

  constructor() {
    this.knn.load();
    playHooks.onPlay = (ms) => this.audio.mute(ms + 150);
    speechHooks.onSpeaking = (on) => {
      this.speaking = on;
      if (on) this.audio.muteUntil = Infinity;
      else {
        this.audio.muteUntil = performance.now() + 300;
        // Safari can pause the preview (or mute capture tracks) when the
        // speech synthesizer takes the audio session. Restore it afterwards.
        if (this.tracker && !this.stopTimer) this.startCamera({ mic: this.captureMic }).catch(() => undefined);
      }
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
  startCamera({ mic = false } = {}) {
    clearTimeout(this.stopTimer);
    this.stopTimer = 0;
    if (this.tracker) {
      const video = this.src?.stream?.getVideoTracks()[0];
      const audio = this.src?.stream?.getAudioTracks()[0];
      const lost = video && (video.readyState === 'ended' || video.muted);
      const needsMic = mic && this.src?.stream && !this.src.micError && (!audio || audio.readyState === 'ended' || audio.muted);
      if (!lost && !needsMic) return this.src?.resume?.().catch(() => undefined) ?? Promise.resolve();
      const listening = this.audio.running;
      const generation = this.micGeneration;
      this.audio.stop();
      this.stopCamera({ stopMic: false });
      return this.startCamera({ mic }).then(() => {
        if (listening && generation === this.micGeneration && !this.stopTimer) return this.startMic();
      });
    }
    if (!this.starting) {
      this.starting = (async () => {
        // ?src=/caminho/foto.jpg replaces the camera while developing
        const asked = DEV ? new URLSearchParams(location.search).get('src') : null;
        const test = asked && new URL(asked, location.href).origin === location.origin ? asked : null;
        // A single capture request avoids one device acquisition interrupting
        // the other on mobile Safari.
        if (this.audio.running && !test) this.audio.stop();
        const [lm, src] = await Promise.all([loadLandmarker(), test ? openTestSource(test) : openCamera({ mic })]);
        this.src = src;
        this.captureMic = mic;
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
    this.stopTimer = window.setTimeout(() => {
      this.stopTimer = 0;
      this.stopCamera();
    }, ms);
  }

  stopCamera({ stopMic = true } = {}) {
    const sharedTracks = this.src?.stream?.getAudioTracks() ?? [];
    if (stopMic && this.audio.stream?.getAudioTracks().some((t) => sharedTracks.includes(t))) this.stopMic();
    this.tracker?.stop();
    this.tracker = null;
    this.src?.stop();
    this.src = null;
    this.last = null;
    this.poses.reset();
  }

  async startMic() {
    const generation = ++this.micGeneration;
    this.applySettings();
    if (this.src?.stream) {
      await this.startCamera({ mic: true });
      if (generation !== this.micGeneration || this.stopTimer) return;
      if (this.src.micError) throw this.src.micError;
    }
    const tracks = this.src?.stream?.getAudioTracks().filter((t) => t.readyState === 'live') ?? [];
    await this.audio.start(tracks.length ? new MediaStream(tracks) : null);
    if (generation !== this.micGeneration || this.stopTimer) this.audio.stop();
  }

  stopMic() { this.micGeneration++; this.audio.stop(); }

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
