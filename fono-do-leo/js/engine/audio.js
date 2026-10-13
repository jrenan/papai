import { norm, percentile } from '../util.js';
import { audioCtx } from './sfx.js';

/*
 * Microphone analysis.
 *  - An AudioWorklet reports RMS per 128-sample block (~2.7 ms), both raw and
 *    high-passed. The high-passed envelope drives click and trill detection
 *    (wind rumble from blowing on the mic is mostly below 300 Hz).
 *  - Every ~21 ms: level vs. an adaptive noise floor (10th percentile of the
 *    last 5 s), pitch strength (voice vs. blowing/hissing) and envelope
 *    modulation at 15-45 Hz (tongue/lip trill, "trrr", "brrr").
 *  - Tongue clicks: a sharp burst that decays within ~45 ms.
 */

const WORKLET = `
class EnvProc extends AudioWorkletProcessor {
  constructor() { super(); this.b = []; this.prev = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      let s = 0, sh = 0, prev = this.prev;
      for (let k = 0; k < ch.length; k++) {
        const x = ch[k]; s += x * x;
        const d = x - prev; sh += d * d; prev = x;
      }
      this.prev = prev;
      this.b.push(Math.sqrt(s / ch.length), Math.sqrt(sh / ch.length));
      if (this.b.length >= 16) { this.port.postMessage(this.b); this.b = []; }
    }
    return true;
  }
}
registerProcessor('env-proc', EnvProc);
`;

let workletReady = null;

export class AudioEngine {
  noiseDb = -60;
  levelDb = -100;
  active = false;
  blowing = false;
  voiced = false;
  trilling = false;
  blowLevel = 0;
  pitch = 0;
  mod = 0;
  sens = 1;
  muteUntil = 0;

  get ctx() { return audioCtx(); }
  stream = null;
  nodes = [];
  analyser = null;
  blockRate = 375;
  raw = new Float32Array(1024);
  env = new Float32Array(1024);
  envN = 0;
  time = new Float32Array(2048);
  ds = new Float32Array(1024);
  modBuf = new Float32Array(256);
  hist = [];
  frameN = 0;
  bg = 0.001;
  pend = null;
  refr = 0;
  seg = null;
  utt = null;
  clickFns = new Set();
  segFns = new Set();
  uttFns = new Set();

  get running() { return !!this.stream; }
  /** Duration of the sound happening right now (ms), 0 when quiet. */
  get currentMs() { return this.seg ? this.seg.last - this.seg.start : 0; }
  get currentTrillFrac() { return this.seg && this.seg.n ? this.seg.trill / this.seg.n : 0; }
  get currentBlowFrac() { return this.seg && this.seg.n ? this.seg.blow / this.seg.n : 0; }

  onClick(fn) { this.clickFns.add(fn); return () => this.clickFns.delete(fn); }
  onSegment(fn) { this.segFns.add(fn); return () => this.segFns.delete(fn); }
  onUtterance(fn) { this.uttFns.add(fn); return () => this.uttFns.delete(fn); }

  mute(ms) { this.muteUntil = Math.max(this.muteUntil, performance.now() + ms); }

  async start() {
    if (this.stream) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Sem acesso ao microfone neste navegador.');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
    const ctx = this.ctx;
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
    if (!workletReady) {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      workletReady = ctx.audioWorklet.addModule(url);
      workletReady.catch(() => { workletReady = null; });
    }
    await workletReady;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;
    const node = new AudioWorkletNode(ctx, 'env-proc');
    node.port.onmessage = (e) => this.onBlocks(e.data);
    const sink = ctx.createGain();
    sink.gain.value = 0;
    src.connect(analyser);
    src.connect(node);
    node.connect(sink);
    sink.connect(ctx.destination);
    this.nodes = [src, analyser, node, sink];
    this.analyser = analyser;
    this.stream = stream;
    this.blockRate = ctx.sampleRate / 128;
    this.hist = [];
    this.noiseDb = -60;
    this.seg = null;
    this.utt = null;
  }

  stop() {
    for (const n of this.nodes) { try { n.disconnect(); } catch { /* ignore */ } }
    this.nodes = [];
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analyser = null;
    this.active = this.blowing = this.voiced = this.trilling = false;
    this.seg = null;
    this.utt = null;
  }

  onBlocks(arr) {
    for (let i = 0; i + 1 < arr.length; i += 2) this.block(arr[i], arr[i + 1]);
    this.frame();
  }

  block(rawRms, hpRms) {
    const L = this.env.length;
    this.raw[this.envN % L] = rawRms;
    this.env[this.envN % L] = hpRms;
    this.envN++;
    const muted = performance.now() < this.muteUntil;
    if (this.refr > 0) this.refr--;
    if (this.pend) {
      const p = this.pend;
      p.n++;
      if (p.n <= 3 && hpRms > p.peak) p.peak = hpRms;
      if (p.n >= 2 && hpRms < p.peak * 0.25) {
        this.pend = null;
        this.refr = Math.round(this.blockRate * 0.12);
        if (!muted) this.clickFns.forEach((f) => f(performance.now()));
      } else if (p.n > this.blockRate * 0.05) {
        this.pend = null;
        this.refr = Math.round(this.blockRate * 0.1);
      }
    } else if (this.refr === 0) {
      const floor = Math.pow(10, (this.noiseDb + 12) / 20);
      const thr = Math.max(this.bg * (5 / this.sens), floor, 0.002);
      if (hpRms > thr) this.pend = { peak: hpRms, n: 0 };
    }
    if (!this.pend) this.bg += (Math.min(hpRms, this.bg * 3) - this.bg) * 0.03;
  }

  frame() {
    const now = performance.now();
    const muted = now < this.muteUntil;
    const L = this.raw.length;
    let s = 0;
    for (let i = 1; i <= 8; i++) { const r = this.raw[(this.envN - i + L) % L]; s += r * r; }
    const db = 10 * Math.log10(s / 8 + 1e-12);
    this.levelDb = db;
    if (!muted) {
      this.hist.push(db);
      if (this.hist.length > 240) this.hist.shift();
    }
    if (++this.frameN % 10 === 0 && this.hist.length >= 10) this.noiseDb = Math.max(-80, percentile(this.hist, 0.1));
    const gate = 11 / this.sens;
    const act = !muted && db > this.noiseDb + gate && db > -62;
    if (act) {
      if (this.frameN % 2 === 0) this.pitch = this.pitchStrength();
      this.mod = this.modulation();
    } else {
      this.pitch = 0;
      this.mod = 0;
    }
    this.active = act;
    this.voiced = act && this.pitch > 0.5;
    this.blowing = act && this.pitch < 0.42;
    this.trilling = act && this.mod > 0.3;
    this.blowLevel = this.blowing ? norm(db - this.noiseDb, gate, gate + 25) : 0;
    this.segmentStep(now, act);
  }

  segmentStep(now, act) {
    if (act) {
      if (!this.seg) this.seg = { start: now, last: now, n: 0, blow: 0, voice: 0, trill: 0 };
      const g = this.seg;
      g.last = now;
      g.n++;
      if (this.blowing) g.blow++;
      if (this.voiced) g.voice++;
      if (this.trilling) g.trill++;
    } else if (this.seg && now - this.seg.last > 150) {
      const g = this.seg;
      this.seg = null;
      const dur = g.last - g.start;
      if (dur >= 80) {
        const seg = { start: g.start, end: g.last, dur, blowFrac: g.blow / g.n, voiceFrac: g.voice / g.n, trillFrac: g.trill / g.n };
        this.segFns.forEach((f) => f(seg));
        if (!this.utt) this.utt = { ...seg };
        else {
          const u = this.utt, w0 = u.dur, w1 = seg.dur, w = w0 + w1 || 1;
          u.blowFrac = (u.blowFrac * w0 + seg.blowFrac * w1) / w;
          u.voiceFrac = (u.voiceFrac * w0 + seg.voiceFrac * w1) / w;
          u.trillFrac = (u.trillFrac * w0 + seg.trillFrac * w1) / w;
          u.end = seg.end;
          u.dur = u.end - u.start;
        }
      }
    }
    if (this.utt && !this.seg && now - this.utt.end > 450) {
      const u = this.utt;
      this.utt = null;
      this.uttFns.forEach((f) => f(u));
    }
  }

  /** Normalised autocorrelation peak in the 90-600 Hz pitch range (pre-emphasised). */
  pitchStrength() {
    const a = this.analyser;
    if (!a) return 0;
    a.getFloatTimeDomainData(this.time);
    const x = this.time, y = this.ds;
    const m = x.length >> 1;
    let prev = 0;
    for (let i = 0; i < m; i++) {
      const v = (x[2 * i] + x[2 * i + 1]) * 0.5;
      y[i] = v - 0.95 * prev;
      prev = v;
    }
    const fs = this.ctx.sampleRate / 2;
    const lagMin = Math.floor(fs / 600);
    const lagMax = Math.min(m >> 1, Math.ceil(fs / 90));
    const W = m - lagMax;
    let e0 = 0;
    for (let i = 0; i < W; i++) e0 += y[i] * y[i];
    let best = 0;
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let c = 0, e1 = 0;
      for (let i = 0; i < W; i++) { const b = y[i + lag]; c += y[i] * b; e1 += b * b; }
      const r = c / Math.sqrt(e0 * e1 + 1e-12);
      if (r > best) best = r;
    }
    return best;
  }

  /** Envelope autocorrelation peak for 15-45 Hz modulation over the last ~320 ms. */
  modulation() {
    const W = Math.min(this.modBuf.length, Math.round(this.blockRate * 0.32));
    const L = this.env.length;
    const e = this.modBuf;
    let mean = 0;
    for (let i = 0; i < W; i++) { e[i] = this.env[(this.envN - W + i + L) % L]; mean += e[i]; }
    mean /= W;
    let r0 = 0;
    for (let i = 0; i < W; i++) { e[i] -= mean; r0 += e[i] * e[i]; }
    if (r0 < 1e-12) return 0;
    const lagMin = Math.round(this.blockRate / 45);
    const lagMax = Math.round(this.blockRate / 15);
    let best = 0;
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let c = 0;
      for (let i = 0; i + lag < W; i++) c += e[i] * e[i + lag];
      const r = (c / r0) * (W / (W - lag));
      if (r > best) best = r;
    }
    return best;
  }
}
