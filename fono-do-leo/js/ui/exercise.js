import { CATS } from '../data/exercises.js';
import { engine } from '../engine/engine.js';
import { sfx } from '../engine/sfx.js';
import { tts } from '../engine/speech.js';
import { store } from '../store.js';
import { h } from '../util.js';
import { faceForPose, faceFromLeo } from './dino.js';
import { Mirror } from './mirror.js';
import { makeRunner } from './runners.js';
import { floater, makeScene } from './scenes.js';

const NUM = ['um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte'];
const CHEERS = ['Muito bem, Leo!', 'Arrasou, Leo!', 'Parabéns, Leo! Você conseguiu!', 'Que boca forte, Leo!', 'Uhuu! Mandou bem!'];

export function exerciseScreen(root, ex, o) {
  let alive = true;
  let started = false;
  let finished = false;
  const t0 = performance.now();
  let count = 0, auto = 0, manual = 0, checkOk = 0, checkTotal = 0;
  let lastProgress = performance.now();
  let lastSeen = performance.now();
  const timers = [];
  const offs = [];

  const scene = makeScene(ex.scene, o.reps);
  const mirror = ex.camera ? new Mirror() : null;
  if (mirror) mirror.overlay = store.settings.debug;
  const cat = CATS[ex.cat];

  // ---------- DOM ----------
  const countEl = h('b', null, '0');
  const header = h('header', { class: 'ex-top' },
    h('button', { class: 'icon-btn', 'aria-label': 'Voltar ao caderno', onclick: () => exit() }, '✕'),
    h('div', { class: 'ex-title' },
      h('span', { class: 'ex-cat' }, (cat.sub ? `${cat.title}: ${cat.sub}` : cat.title) + (o.pos ? ` · ${o.pos.i + 1} de ${o.pos.n}` : '')),
      h('h1', null, ex.name)),
    h('div', { class: 'ex-count', 'aria-live': 'polite' }, countEl, h('span', null, `/${o.reps}`)));

  const dots = h('div', { class: 'ex-dots' }, Array.from({ length: Math.min(o.reps, 24) }, () => h('i')));
  const ringArc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ringArc.setAttribute('cx', '30'); ringArc.setAttribute('cy', '30'); ringArc.setAttribute('r', '26');
  ringArc.setAttribute('class', 'ring-arc');
  const ringSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ringSvg.setAttribute('viewBox', '0 0 60 60');
  ringSvg.setAttribute('class', 'ring');
  const ringBg = ringArc.cloneNode();
  ringBg.setAttribute('class', 'ring-bg');
  ringSvg.append(ringBg, ringArc);
  const pillEmoji = h('span', { class: 'pill-emoji' }, ex.emoji);
  const pillText = h('span', { class: 'pill-text' }, ex.name.toUpperCase());
  const pillSub = h('span', { class: 'pill-sub' });
  const pill = h('div', { class: 'pill' }, h('div', { class: 'pill-icon' }, ringSvg, pillEmoji), h('div', { class: 'pill-words' }, pillText, pillSub));
  const warn = h('div', { class: 'face-warn', hidden: true });
  const loading = h('div', { class: 'loading' }, h('span', { class: 'egg' }, '🥚'), 'O Dino está acordando…');
  const mirrorWrap = h('div', { class: 'mirror-wrap' + (ex.camera ? '' : ' no-cam') },
    mirror ? mirror.el : h('div', { class: 'mirror mirror-off' }, h('span', null, ex.emoji), h('small', null, 'Este exercício usa só o microfone')),
    warn, loading);
  const plusBtn = h('button', { class: 'btn-ghost plus', onclick: () => plusOne() }, '+1 ajudinha');
  const skipBtn = h('button', { class: 'btn-ghost', onclick: () => finish(false) }, 'Pular');
  const startBtn = h('button', { class: 'btn-go', onclick: () => begin() }, 'Começar ▶');
  const debugBox = h('pre', { class: 'debug-box', hidden: !store.settings.debug });
  const screen = h('div', { class: `screen ex-screen cat-${ex.cat}` },
    header,
    h('div', { class: 'ex-main' },
      h('div', { class: 'stage-card' }, scene.root, dots),
      h('div', { class: 'ex-side' }, mirrorWrap, pill)),
    h('footer', { class: 'ex-foot' }, skipBtn, startBtn, plusBtn),
    debugBox);
  root.replaceChildren(screen);

  const setRing = (p) => {
    const c = 2 * Math.PI * 26;
    ringArc.style.strokeDasharray = `${c}`;
    ringArc.style.strokeDashoffset = `${c * (1 - p)}`;
  };
  setRing(0);

  // ---------- runner context ----------
  const ctx = {
    ex, total: o.reps, scene,
    pill(t, e, sub) {
      if (pillText.textContent !== t || pillEmoji.textContent !== e) {
        pillText.textContent = t;
        pillEmoji.textContent = e;
        pill.animate([{ scale: '0.92' }, { scale: '1' }], { duration: 200, easing: 'ease-out' });
      }
      pillSub.textContent = sub ?? '';
    },
    holdRing: setRing,
    rep(kind) {
      if (!alive || finished || count >= o.reps) return;
      count++;
      if (kind === 'auto') auto++;
      if (kind === 'manual') manual++;
      countEl.textContent = String(count);
      countEl.animate([{ scale: '1.6' }, { scale: '1' }], { duration: 350, easing: 'ease-out' });
      const d = dots.children[Math.min(dots.children.length - 1, Math.floor(((count - 1) / o.reps) * dots.children.length))];
      d?.classList.add('on', kind === 'auto' ? 'auto' : 'help');
      scene.rep(count, o.reps);
      setRing(0);
      if (kind !== 'miss') {
        sfx.play('rep');
        const r = scene.root.getBoundingClientRect();
        floater(scene.root, '⭐', r.width * 0.5, r.height * 0.45, { dy: -r.height * 0.4, size: 44, dur: 800 });
      }
      lastProgress = performance.now();
      if (count >= o.reps) {
        timers.push(window.setTimeout(() => finish(true), 700));
      } else if (!ex.mic && ex.kind.type === 'face') {
        tts.say(NUM[count - 1] ? `${NUM[count - 1][0].toUpperCase()}${NUM[count - 1].slice(1)}!` : '');
      } else if (count === Math.ceil(o.reps / 2)) {
        const r = scene.root.getBoundingClientRect();
        floater(scene.root, 'Metade!', r.width * 0.5, r.height * 0.25, { cls: 'word', dy: -30, dur: 1400 });
      }
    },
    progress() { lastProgress = performance.now(); },
    check(ok) { checkTotal++; if (ok) checkOk++; },
    get reps() { return count; },
    get alive() { return alive && !finished && count < o.reps; },
  };
  const runner = makeRunner(ctx);

  function plusOne() {
    if (!started) begin();
    ctx.rep('manual');
    runner.manual?.();
    plusBtn.classList.remove('pulse');
  }

  // ---------- demo before starting ----------
  scene.mirror = false;
  let demoI = 0;
  const demo = () => {
    if (started || !alive) return;
    const k = ex.kind;
    if (k.type === 'face') {
      const st = k.steps[demoI++ % k.steps.length];
      scene.dino.set(st.not ? {} : faceForPose(st.any[0]));
    } else if (k.type === 'trill') {
      scene.dino.set(demoI++ % 2 ? { trill: 1, pucker: k.lips === 'closed' ? 0.3 : 0, jaw: k.lips === 'closed' ? 0 : 0.15 } : {});
    } else if (k.type === 'breath') {
      scene.dino.set(demoI++ % 2 ? { pucker: 0.8, blow: 0.9 } : { blinkL: 1, blinkR: 1 });
    } else if (k.type === 'click') {
      scene.dino.set(demoI++ % 2 ? { jaw: 0.25, smile: 0 } : { jaw: 0, pucker: 0.2 });
    } else {
      scene.dino.set(demoI++ % 2 ? { jaw: 0.35, smile: 0.3 } : { smile: 0.5 });
    }
    timers.push(window.setTimeout(demo, 1100));
  };
  demo();

  function begin() {
    if (started || !alive) return;
    started = true;
    startBtn.hidden = true;
    tts.stop();
    scene.mirror = ex.kind.type !== 'simon';
    scene.dino.idle = !ex.camera || !engine.cameraOn;
    if (ex.kind.type === 'simon') scene.dino.set({});
    lastProgress = performance.now();
    runner.start();
  }

  async function prepare() {
    if (ex.camera) {
      loading.hidden = engine.cameraOn;
      try {
        await engine.startCamera();
      } catch (e) {
        showDeviceError(`Não consegui abrir a câmera (${(e).message || e}). O adulto pode usar o botão +1.`);
      }
      loading.hidden = true;
    } else {
      loading.hidden = true;
    }
    if (ex.mic) {
      try {
        await engine.startMic();
      } catch (e) {
        showDeviceError(`Não consegui ouvir o microfone (${(e).message || e}). O adulto pode usar o botão +1.`);
      }
    }
    if (!alive) return;
    await tts.say(ex.intro);
    if (alive && !started) timers.push(window.setTimeout(begin, 250));
  }

  function showDeviceError(msg) {
    warn.hidden = false;
    warn.textContent = msg;
    warn.classList.add('error');
  }

  // ---------- per-frame ----------
  offs.push(engine.onFrame((f, p) => {
    if (!alive) return;
    if (f.present) lastSeen = performance.now();
    if (ex.camera && started && !warn.classList.contains('error')) {
      const gone = performance.now() - lastSeen > 1200;
      const msg = gone ? 'Cadê o Leo? Olha pro espelho! 👀' : f.quality === 'far' ? 'Chega mais perto! 🔍' : f.quality === 'turned' ? 'Olha pra frente! 🙂' : '';
      warn.hidden = !msg;
      if (msg) warn.textContent = msg;
    }
    if (scene.mirror && started) scene.dino.set(f.present ? { ...faceFromLeo(f, p), ...scene.extra } : scene.extra);
    if (started && !finished) runner.frame?.(f);
    if (store.settings.debug) {
      const top = Object.entries(p.score).sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([k, v]) => `${k}: ${v.toFixed(2)}${p.is(k) ? ' ●' : ''}`);
      const a = engine.audio;
      debugBox.textContent = [
        `fps ${engine.tracker?.fps.toFixed(0) ?? '-'} · ${f.quality}${p.usingKnn ? ' · knn' : ''}`,
        ...top,
        ...Object.entries(p.dbg).map(([k, v]) => `${k}: ${v.toFixed(3)}`),
        a.running ? `som ${a.levelDb.toFixed(0)}dB ruído ${a.noiseDb.toFixed(0)} voz ${a.pitch.toFixed(2)} vib ${a.mod.toFixed(2)}` : '',
      ].join('\n');
    }
  }));

  // dino effects when there are no camera frames (microphone-only exercises)
  let raf = 0;
  const effects = () => {
    raf = requestAnimationFrame(effects);
    if (started && scene.mirror && (!ex.camera || !engine.cameraOn)) scene.dino.set(scene.extra);
  };
  effects();

  // "need help?" — repeat the hint and highlight the parent's +1
  timers.push(window.setInterval(() => {
    if (!started || finished || !alive || engine.isSpeaking) return;
    if (performance.now() - lastProgress > 11000) {
      lastProgress = performance.now() - 2000;
      sfx.play('hint');
      tts.say(ex.hint);
      plusBtn.classList.add('pulse');
    }
  }, 1000));

  // ---------- end ----------
  function finish(done) {
    if (finished) return;
    finished = true;
    runner.stop();
    tts.stop();
    store.log(ex.id, { reps: count, auto, manual, ms: performance.now() - t0, done, checkOk, checkTotal });
    if (!done) { o.onNext(); return; }
    celebrate();
  }

  function exit() {
    if (!finished) {
      finished = true;
      runner.stop();
      if (count > 0) store.log(ex.id, { reps: count, auto, manual, ms: performance.now() - t0, done: false, checkOk, checkTotal });
    }
    o.onHome();
  }

  function celebrate() {
    const sticker = store.award();
    sfx.play('done');
    tts.say(CHEERS[Math.floor(Math.random() * CHEERS.length)]);
    scene.mirror = false;
    scene.dino.set({ smile: 1, jaw: 0.3 });
    const confetti = h('div', { class: 'confetti' });
    const colors = ['#FFC83D', '#E8505B', '#4A9BC8', '#6CC04A', '#9B5BD0'];
    for (let i = 0; i < 46; i++) {
      const c = h('i');
      c.style.background = colors[i % colors.length];
      c.style.left = `${Math.random() * 100}%`;
      confetti.append(c);
      c.animate([{ transform: `translateY(-10vh) rotate(0deg)` }, { transform: `translateY(110vh) rotate(${600 + Math.random() * 600}deg)` }],
        { duration: 1800 + Math.random() * 1600, delay: Math.random() * 500, easing: 'cubic-bezier(.3,.6,.6,1)', fill: 'forwards' });
    }
    const autoTxt = auto === count ? 'todas pegas pelo Dino! 🦕' : auto ? `${auto} pegas pelo Dino 🦕` : '';
    const bar = h('i');
    const nextBtn = o.nextName
      ? h('button', { class: 'btn-go big', onclick: () => o.onNext() }, h('span', null, `Próximo: ${o.nextName} ▶`), h('span', { class: 'autobar' }, bar))
      : h('button', { class: 'btn-go big', onclick: () => o.onHome() }, 'Voltar ao caderno');
    const card = h('div', { class: 'done-card' },
      h('div', { class: 'stamp' }, 'FEITO!'),
      h('div', { class: 'sticker big' }, sticker),
      h('p', { class: 'done-title' }, 'Figurinha nova pro álbum!'),
      h('p', { class: 'done-sub' }, [ex.name, `${count}x`, autoTxt].filter(Boolean).join(' · ')),
      nextBtn,
      h('div', { class: 'done-row' },
        h('button', { class: 'btn-ghost', onclick: () => o.onRepeat() }, 'Repetir'),
        o.nextName ? h('button', { class: 'btn-ghost', onclick: () => o.onHome() }, 'Caderno') : null));
    screen.append(h('div', { class: 'done-overlay' }, confetti, card));
    if (o.nextName) {
      bar.animate([{ width: '0%' }, { width: '100%' }], { duration: 7000, fill: 'forwards' }).onfinish = () => { if (alive) o.onNext(); };
    }
  }

  prepare();

  return () => {
    alive = false;
    finished = true;
    runner.stop();
    offs.forEach((f) => f());
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    cancelAnimationFrame(raf);
    tts.stop();
    scene.destroy();
    mirror?.destroy();
  };
}
