import { ANIMALS, POSE_LABEL, POSE_SAY, SIMON_POOL } from '../data/exercises.js';
import { engine } from '../engine/engine.js';
import { sfx } from '../engine/sfx.js';
import { hasRecognition, listenOnce, tts } from '../engine/speech.js';
import { store } from '../store.js';
import { clamp, fold, h, shuffle, sleep } from '../util.js';
import { faceForPose } from './dino.js';
import { floater } from './scenes.js';

export function makeRunner(c) {
  const k = c.ex.kind;
  switch (k.type) {
    case 'face': return new StepsRunner(c, k.steps);
    case 'breath': return new BreathRunner(c);
    case 'click': return new ClickRunner(c);
    case 'trill': return new TrillRunner(c, k.minMs, k.lips);
    case 'sound': return new SoundRunner(c, k.minMs);
    case 'phrase': return new PhraseRunner(c, k.text, k.minMs);
    case 'animal': return new AnimalRunner(c, k.animal);
    case 'simon': return new SimonRunner(c);
  }
}

function stepLabel(s) {
  if (s.not) return { t: 'SOLTA', e: '😌' };
  return POSE_LABEL[s.any[0]];
}

/** Hold-then-release state machine over pose activations. */
class StepsRunner {
  i = 0;
  held = 0;
  grace = 0;
  lastT = 0;
  constructor(c, steps) {
    this.c = c;
    this.steps = steps;
  }

  start() { this.announce(); }

  announce() {
    const s = this.steps[this.i];
    const l = stepLabel(s);
    this.c.pill(l.t, l.e);
    this.c.scene.expect(this.i);
  }

  frame(f) {
    const dt = this.lastT ? clamp(f.t - this.lastT, 0, 100) : 0;
    this.lastT = f.t;
    if (!f.present || f.quality !== 'ok') return;
    const s = this.steps[this.i];
    const p = engine.poses;
    const ok = s.not ? !p.is(s.not) : s.any.some((x) => p.is(x));
    if (ok) {
      this.held += dt;
      this.grace = 0;
    } else {
      this.grace += dt;
      if (this.grace > 160) this.held = Math.max(0, this.held - dt * 1.5);
    }
    const prog = clamp(this.held / s.holdMs);
    this.c.holdRing(s.not ? 0 : prog);
    this.c.scene.hold(prog, this.i);
    if (this.held >= s.holdMs) {
      this.held = 0;
      this.grace = 0;
      this.c.scene.stepDone(this.i);
      this.c.progress();
      this.i++;
      if (this.i >= this.steps.length) {
        this.i = 0;
        this.c.rep('auto');
      } else if (!this.steps[this.i].not) {
        sfx.play('tick');
      }
      if (this.c.alive) this.announce();
    }
  }

  manual() {
    this.i = 0;
    this.held = 0;
    this.announce();
  }

  stop() {}
}

/** Smell the flower (mouth closed, ~2 s) then blow the candle (microphone). */
class BreathRunner {
  phase = 'smell';
  held = 0;
  lastT = 0;
  off = null;
  raf = 0;
  cycles = 0;
  constructor(c) {
    this.c = c;
  }

  start() {
    this.toSmell();
    this.off = engine.audio.onSegment((s) => this.onSeg(s));
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (this.phase === 'blow') this.c.scene.level(engine.audio.blowing ? Math.max(0.15, engine.audio.blowLevel) : 0);
      if (!engine.cameraOn && this.phase === 'smell') this.tickSmell(performance.now(), true);
    };
    loop();
  }

  toSmell() {
    this.phase = 'smell';
    this.held = 0;
    this.c.scene.phase('smell');
    this.c.pill('CHEIRA A FLOR', '🌸', 'boca fechada, ar pelo nariz');
    if (this.cycles < 2) tts.say('Cheira a florzinha... hummm.');
  }

  toBlow() {
    this.phase = 'blow';
    this.c.scene.phase('blow');
    this.c.holdRing(0);
    this.c.pill('SOPRA A VELA!', '🕯️', 'fuuuuu!');
    sfx.play('tick');
    if (this.cycles < 2) tts.say('Agora sopra!');
  }

  frame(f) {
    if (this.phase !== 'smell') return;
    this.tickSmell(f.t, f.present && engine.poses.is('bocaFechada'));
  }

  tickSmell(t, ok) {
    const dt = this.lastT ? clamp(t - this.lastT, 0, 100) : 0;
    this.lastT = t;
    if (ok && !engine.isSpeaking) this.held += dt;
    else this.held = Math.max(0, this.held - dt);
    const p = clamp(this.held / 2200);
    this.c.holdRing(p);
    this.c.scene.hold(p, 0);
    if (p >= 1) { this.c.progress(); this.toBlow(); }
  }

  onSeg(s) {
    if (this.phase !== 'blow') return;
    if (s.dur >= 400 && s.blowFrac >= 0.4) {
      sfx.play('whoosh');
      this.cycles++;
      this.c.scene.level(0);
      this.c.rep('auto');
      if (this.c.alive) setTimeout(() => this.c.alive && this.toSmell(), 700);
    }
  }

  manual() { this.c.scene.level(0); this.cycles++; setTimeout(() => this.c.alive && this.toSmell(), 400); }

  stop() {
    this.off?.();
    cancelAnimationFrame(this.raf);
  }
}

class ClickRunner {
  off = null;
  constructor(c) {
    this.c = c;
  }
  start() {
    this.c.pill('CLOC! CLOC!', '🐴', 'estala a língua');
    this.off = engine.audio.onClick(() => {
      sfx.play('clop');
      this.c.progress();
      this.c.rep('auto');
    });
  }
  stop() { this.off?.(); }
}

/**
 * Trills ("trrr", "brrr"): a sound of at least minMs with envelope modulation.
 * If he keeps trying and the detector does not hear the vibration, it gets
 * more lenient after two attempts so he never gets stuck.
 */
class TrillRunner {
  offs = [];
  raf = 0;
  misses = 0;
  openFrames = 0;
  closedFrames = 0;
  constructor(c, minMs, lips) {
    this.c = c;
    this.minMs = minMs;
    this.lips = lips;
  }

  start() {
    const moto = this.lips === 'closed';
    this.c.pill(moto ? 'BRRRRUM!' : 'TRRRRR!', moto ? '🏍️' : '🚜', moto ? 'lábios juntinhos vibrando' : 'língua vibrando');
    this.offs.push(engine.audio.onSegment((s) => this.onSeg(s)));
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const a = engine.audio;
      const ms = a.currentMs;
      const vib = a.trilling || this.misses >= 2;
      this.c.scene.level(a.active && vib ? clamp(ms / this.minMs) : 0);
      this.c.scene.extra = { trill: a.active && a.trilling ? 1 : 0 };
      this.c.holdRing(a.active ? clamp(ms / this.minMs) : 0);
    };
    loop();
  }

  frame(f) {
    if (!engine.audio.active || !f.m) return;
    if (f.m.openIn < 0.08) this.closedFrames++; else this.openFrames++;
  }

  onSeg(s) {
    const closedFrac = this.closedFrames / Math.max(1, this.closedFrames + this.openFrames);
    this.closedFrames = this.openFrames = 0;
    if (s.dur < this.minMs) return;
    const vibrated = s.trillFrac >= 0.18;
    if (vibrated || this.misses >= 2) {
      this.misses = 0;
      this.c.progress();
      if (this.lips === 'closed' && engine.cameraOn) this.c.check(closedFrac > 0.5);
      this.c.rep(vibrated ? 'auto' : 'miss');
    } else {
      this.misses++;
      tts.say(this.lips === 'closed' ? 'Quase! Deixa os lábios bem molinhos.' : 'Quase! Faz a língua tremer.');
    }
  }

  manual() { this.misses = 0; }

  stop() {
    this.offs.forEach((o) => o());
    cancelAnimationFrame(this.raf);
  }
}

/** Any sustained sound ("rrrrr", gargling). */
class SoundRunner {
  off = null;
  raf = 0;
  constructor(c, minMs) {
    this.c = c;
    this.minMs = minMs;
  }
  start() {
    const rato = this.c.ex.id === 'rato';
    this.c.pill(rato ? 'RRRRRRR!' : 'GRRRRR!', rato ? '🐭' : '🥛', rato ? 'bem comprido' : 'gargarejo');
    this.off = engine.audio.onSegment((s) => {
      if (s.dur >= this.minMs) {
        this.c.progress();
        this.c.rep('auto');
      } else if (s.dur > 250) {
        tts.say('Mais comprido!');
      }
    });
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const a = engine.audio;
      const p = a.active ? clamp(a.currentMs / this.minMs) : 0;
      this.c.scene.level(p);
      this.c.holdRing(p);
    };
    loop();
  }
  stop() {
    this.off?.();
    cancelAnimationFrame(this.raf);
  }
}

/** Tongue twister: say the whole phrase (one utterance), checked with speech recognition when enabled. */
class PhraseRunner {
  stopped = false;
  skip = false;
  chips = [];
  cancelListen = null;
  constructor(c, text, minMs) {
    this.c = c;
    this.text = text;
    this.minMs = minMs;
    this.chips = text.split(' ').map((w) => h('span', { class: 'chip' }, w.toUpperCase()));
    c.scene.slot.replaceChildren(h('div', { class: 'phrase' }, h('div', { class: 'phrase-pics' }, '🐭 👕 👑'), h('div', { class: 'chips' }, this.chips)));
  }

  start() {
    this.c.pill('ESCUTA', '👂');
    this.loop();
  }

  light(n) { this.chips.forEach((ch, i) => ch.classList.toggle('lit', i < n)); }

  async loop() {
    let again = false;
    while (!this.stopped && this.c.alive) {
      this.light(0);
      this.c.pill('ESCUTA', '👂');
      await tts.say(again ? `De novo, devagarinho: ${this.text}` : this.text, { rate: 0.8 });
      if (this.stopped) return;
      this.c.pill('SUA VEZ!', '🎤', 'fala a frase toda');
      const ok = await this.listen();
      if (this.stopped || !this.c.alive) return;
      if (this.skip) {
        this.skip = false;
        this.light(this.chips.length);
        await sleep(700);
        again = false;
        continue;
      }
      if (ok) {
        this.light(this.chips.length);
        this.c.progress();
        this.c.rep('auto');
        await sleep(900);
      }
      again = !ok;
    }
  }

  listen() {
    const words = this.text.split(' ').map(fold);
    if (store.settings.speechRec && hasRecognition()) {
      engine.stopMic();
      const l = listenOnce(9000, (partial) => {
        const heard = new Set(fold(partial).split(/\s+/));
        this.light(words.filter((w) => heard.has(w)).length);
      });
      this.cancelListen = l.cancel;
      return l.result.then(async (t) => {
        this.cancelListen = null;
        await engine.startMic().catch(() => undefined);
        if (!t) return false;
        const heard = new Set(fold(t).split(/[\s|]+/));
        return words.filter((w) => heard.has(w)).length / words.length >= 0.5;
      });
    }
    return new Promise((resolve) => {
      let total = 0;
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        off();
        clearTimeout(timer);
        clearInterval(iv);
        this.cancelListen = null;
        resolve(v);
      };
      const off = engine.audio.onUtterance((u) => {
        total += u.dur;
        if (u.dur >= this.minMs || total >= this.minMs * 1.4) finish(true);
      });
      const iv = setInterval(() => {
        const ms = total + engine.audio.currentMs;
        this.light(Math.round(clamp(ms / (this.minMs * 1.2)) * this.chips.length));
      }, 120);
      const timer = setTimeout(() => finish(false), 10000);
      this.cancelListen = () => finish(false);
    });
  }

  manual() {
    this.skip = true;
    this.cancelListen?.();
  }

  stop() {
    this.stopped = true;
    this.cancelListen?.();
    tts.stop();
  }
}

/**
 * Farm animals: imitate the animal sound, then repeat words.
 * The camera checks the lips at the start of each word: /m/ and /p/ need the
 * lips closed right before the voice starts.
 */
class AnimalRunner {
  stopped = false;
  skipped = false;
  cancel = null;
  card;
  constructor(c, id) {
    this.c = c;
    this.id = id;
    const a = ANIMALS[this.id];
    this.card = h('div', { class: 'farm-card' });
    this.c.scene.slot.replaceChildren(this.card);
    this.show(a.emoji, a.sound, true);
  }

  start() { this.run(); }

  show(emoji, text, animal = false) {
    this.card.replaceChildren(
      h('div', { class: 'farm-pic' + (animal ? ' animal' : '') }, emoji || '💬'),
      h('div', { class: 'farm-word' }, text),
    );
    this.card.animate([{ scale: '0.7', opacity: 0 }, { scale: '1', opacity: 1 }], { duration: 260, easing: 'ease-out' });
  }

  async run() {
    const a = ANIMALS[this.id];
    const n = this.c.total;
    const words = shuffle(a.words).slice(0, Math.max(1, n - 1));
    // 1) the animal sound
    const who = { vaca: 'A vaca', gato: 'O gato', pinto: 'O pintinho', galinha: 'A galinha' }[this.id];
    await tts.say(`${who} faz: ${a.say}! Faz também!`);
    if (!(await this.attempt(a.sound, true))) return;
    // 2) words
    for (const w of words) {
      if (this.stopped || !this.c.alive) return;
      this.show(w.e ?? '', w.w);
      this.c.pill('FALA:', w.e ?? '🗣️', w.w);
      await tts.say(w.w.toLowerCase());
      if (!(await this.attempt(w.w, false))) return;
    }
  }

  /** Wait for him to say it; returns false if the exercise ended meanwhile. */
  async attempt(label, isAnimal) {
    for (let tries = 0; tries < 3; tries++) {
      if (this.stopped || !this.c.alive) return false;
      this.c.pill(isAnimal ? 'FAZ IGUAL!' : 'SUA VEZ!', '🎤', label);
      const u = await this.waitUtterance();
      if (this.stopped || !this.c.alive) return false;
      if (this.skipped) { this.skipped = false; return true; }
      if (!u) {
        if (tries < 2) await tts.say(tries === 0 ? 'Não ouvi! Fala mais alto.' : `Fala comigo: ${label.toLowerCase()}`);
        continue;
      }
      const check = this.visemeCheck(u.start, u.end);
      if (check !== null) this.c.check(check);
      const m = this.c.scene.root.getBoundingClientRect();
      floater(this.c.scene.root, check === false ? '👄' : '⭐', m.width * 0.5, m.height * 0.35, { size: 40, dy: -60 });
      this.c.progress();
      this.c.rep('auto');
      if (check === false && ANIMALS[this.id].check !== 'co') await tts.say('Isso! Lembra de juntar os lábios no começo.');
      else await sleep(500);
      return true;
    }
    // three silent tries: move on
    this.c.rep('miss');
    return true;
  }

  waitUtterance() {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        off();
        clearTimeout(timer);
        this.cancel = null;
        resolve(v);
      };
      const off = engine.audio.onUtterance((u) => { if (u.dur >= 180) finish(u); });
      const timer = setTimeout(() => finish(null), 7000);
      this.cancel = () => finish(null);
    });
  }

  /** true/false when the camera could judge the lips, null when it could not. */
  visemeCheck(t0, t1) {
    if (!engine.cameraOn) return null;
    const kind = ANIMALS[this.id].check;
    const before = engine.window(t0 - 450, t0 + 150);
    const during = engine.window(t0, t1);
    if (before.length < 3) return null;
    const closedAtStart = before.some((h) => h.open < 0.035);
    if (kind === 'co') return during.some((h) => h.jaw > 0.12 || h.pucker > 0.35);
    return closedAtStart;
  }

  manual() {
    this.skipped = true;
    this.cancel?.();
  }

  stop() {
    this.stopped = true;
    this.cancel?.();
    tts.stop();
  }
}

/** "Caretas com o Dino": the dino makes a face, Leo copies it within a few seconds. */
class SimonRunner {
  target = null;
  deadline = 0;
  held = 0;
  lastT = 0;
  round = 0;
  busy = false;
  stopped = false;
  prev = null;
  constructor(c) {
    this.c = c;
  }

  start() {
    this.c.scene.mirror = false;
    this.next();
  }

  async next() {
    if (this.stopped || !this.c.alive) return;
    this.busy = true;
    this.target = null;
    const pool = SIMON_POOL.filter((p) => p !== this.prev);
    const p = pool[Math.floor(Math.random() * pool.length)];
    this.prev = p;
    this.c.scene.dino.set(faceForPose(p));
    const l = POSE_LABEL[p];
    this.c.pill(l.t, l.e, 'faz igual ao Dino!');
    await tts.say(POSE_SAY[p]);
    if (this.stopped) return;
    this.target = p;
    this.held = 0;
    this.deadline = performance.now() + 7000;
    this.busy = false;
  }

  frame(f) {
    if (this.busy || !this.target) return;
    const dt = this.lastT ? clamp(f.t - this.lastT, 0, 100) : 0;
    this.lastT = f.t;
    if (f.present && engine.poses.is(this.target)) this.held += dt;
    else this.held = Math.max(0, this.held - dt);
    this.c.holdRing(clamp(this.held / 600));
    if (this.held >= 600) this.finish(true);
    else if (performance.now() > this.deadline) this.finish(false);
  }

  finish(ok) {
    this.busy = true;
    this.round++;
    if (ok) {
      sfx.play('sparkle');
      this.c.progress();
      this.c.rep('auto');
    } else {
      tts.say('Quase! Próxima!');
      this.c.rep('miss');
    }
    this.c.scene.dino.set({ smile: 0.8 });
    setTimeout(() => this.next(), 1100);
  }

  manual() {
    this.busy = true;
    this.target = null;
    setTimeout(() => this.next(), 600);
  }

  stop() {
    this.stopped = true;
    tts.stop();
  }
}
