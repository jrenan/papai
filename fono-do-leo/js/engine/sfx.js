/* Synthesised sound effects (no audio files) on one shared AudioContext. */

let ctx = null;

/** Called whenever we make a sound, so the microphone ignores our own speaker. */
export const playHooks = { onPlay: (_ms) => {} };

export function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || (window).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

/** Must run inside a tap handler (iOS). */
export function unlockAudio() {
  const c = audioCtx();
  if (c.state === 'suspended') c.resume().catch(() => undefined);
  const b = c.createBuffer(1, 1, 22050);
  const s = c.createBufferSource();
  s.buffer = b;
  s.connect(c.destination);
  s.start(0);
}

function out(gain) {
  const c = audioCtx();
  const g = c.createGain();
  g.gain.value = gain;
  g.connect(c.destination);
  return g;
}

function tone(freq, at, dur, opts = {}) {
  const c = audioCtx();
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.25, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(out(1));
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(at, dur, freq, gain = 0.2, q = 1) {
  const c = audioCtx();
  const t0 = c.currentTime + at;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = gain;
  s.connect(f).connect(g).connect(out(1));
  s.start(t0);
}

export const sfx = {
  enabled: true,
  play(name) {
    if (!this.enabled || !ctx) return;
    const ms = SOUNDS[name]();
    playHooks.onPlay(ms);
  },
};

const SOUNDS = {
  tick: () => { tone(880, 0, 0.09, { type: 'triangle', gain: 0.18 }); return 100; },
  pop: () => { tone(320, 0, 0.12, { to: 900, gain: 0.3 }); return 140; },
  rep: () => { tone(660, 0, 0.1, { type: 'triangle', gain: 0.25 }); tone(990, 0.08, 0.16, { type: 'triangle', gain: 0.25 }); return 260; },
  nom: () => { tone(220, 0, 0.08, { type: 'square', gain: 0.12, to: 140 }); tone(260, 0.1, 0.08, { type: 'square', gain: 0.12, to: 160 }); return 200; },
  clop: () => { tone(900, 0, 0.05, { type: 'square', gain: 0.18, to: 500 }); noise(0, 0.05, 1500, 0.25, 4); return 80; },
  whoosh: () => { noise(0, 0.45, 900, 0.35, 0.7); return 470; },
  boing: () => { tone(180, 0, 0.35, { to: 520, type: 'sine', gain: 0.3 }); return 380; },
  sparkle: () => { [1320, 1568, 1976, 2637].forEach((f, i) => tone(f, i * 0.06, 0.18, { type: 'sine', gain: 0.14 })); return 420; },
  done: () => {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.3, { type: 'triangle', gain: 0.22 }));
    tone(1318, 0.5, 0.5, { type: 'sine', gain: 0.18 });
    return 1100;
  },
  hint: () => { tone(500, 0, 0.12, { type: 'sine', gain: 0.15 }); tone(420, 0.12, 0.16, { type: 'sine', gain: 0.15 }); return 300; },
};
