import { sfx } from '../engine/sfx.js';
import { clamp, h } from '../util.js';
import { Dino } from './dino.js';

/*
 * Each exercise has a little scene around the dino: flies to catch, chocolate
 * to lick off, candles to blow out... Runners drive scenes through these hooks.
 */

export function floater(stage, text, x, y,
  o = {}) {
  const el = h('span', { class: 'floater ' + (o.cls ?? '') }, text);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  if (o.size) el.style.fontSize = `${o.size}px`;
  stage.append(el);
  const dx = o.dx ?? 0, dy = o.dy ?? -80;
  const a = el.animate(
    [
      { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 1, offset: 0.15 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, opacity: 0 },
    ],
    { duration: o.dur ?? 1100, easing: 'cubic-bezier(.2,.7,.3,1)' },
  );
  a.onfinish = () => el.remove();
}

function local(stage, p) {
  const r = stage.getBoundingClientRect();
  return { x: p.x - r.left, y: p.y - r.top };
}

function track(stage, runner, goal) {
  const runnerEl = h('span', { class: 'runner' }, runner);
  const ground = h('div', { class: 'ground' }, h('div', { class: 'lane' }), h('span', { class: 'goal' }, goal), runnerEl);
  stage.append(ground);
  let pos = 0;
  return {
    set(p) {
      pos = clamp(p);
      runnerEl.style.right = `${4 + pos * 74}%`;
    },
    go(on) { runnerEl.classList.toggle('go', on); },
    hop() { runnerEl.animate([{ translate: '0 0' }, { translate: '0 -22px' }, { translate: '0 0' }], { duration: 260, easing: 'ease-out' }); },
  };
}

const noop = () => {};

export function makeScene(id, total) {
  const dino = new Dino();
  const slot = h('div', { class: 'slot' });
  const root = h('div', { class: `stage scene-${id}` }, h('div', { class: 'stage-dino' }, dino.el), slot);
  const mouth = () => local(root, dino.toClient());
  const cleanups = [];
  const s = {
    root, dino, slot, mirror: true, extra: {},
    expect: noop, hold: noop, stepDone: noop, rep: noop, level: noop, phase: noop,
    destroy() {
      cleanups.forEach((c) => c());
      dino.destroy();
      root.remove();
    },
  };

  switch (id) {
    case 'flies': {
      const flies = [0, 1, 2].map((i) => {
        const el = h('span', { class: 'prop fly' }, '🪰');
        root.append(el);
        return { el, ph: i * 2.1, sp: 0.0009 + i * 0.00025, alive: true };
      });
      let raf = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const t = performance.now();
        const w = root.clientWidth, hh = root.clientHeight;
        for (const f of flies) {
          if (!f.alive) continue;
          const x = w * 0.5 + w * 0.4 * Math.cos(t * f.sp + f.ph) + Math.sin(t * 0.011 + f.ph) * 5;
          const y = hh * 0.2 + hh * 0.12 * Math.sin(t * f.sp * 1.7 + f.ph) + Math.cos(t * 0.013 + f.ph) * 5;
          f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%)`;
        }
      };
      loop();
      cleanups.push(() => cancelAnimationFrame(raf));
      s.stepDone = (i) => {
        if (i !== 0) return;
        const f = flies.find((x) => x.alive);
        if (!f) return;
        f.alive = false;
        const m = mouth();
        const anim = f.el.animate([{ transform: f.el.style.transform }, { transform: `translate(${m.x}px, ${m.y + 20}px) translate(-50%,-50%) scale(.2)` }], { duration: 260, easing: 'ease-in', fill: 'forwards' });
        anim.onfinish = () => {
          f.el.style.opacity = '0';
          sfx.play('nom');
          floater(root, 'nham!', m.x + 50, m.y, { cls: 'word', dy: -50 });
          setTimeout(() => { anim.cancel(); f.el.style.opacity = '1'; f.alive = true; f.ph = Math.random() * 6; }, 900);
        };
      };
      break;
    }

    case 'chocolate': {
      s.expect = (i) => { dino.wear('chocL', i === 0); dino.wear('chocR', i === 1); };
      s.stepDone = (i) => {
        const p = local(root, dino.toClient(i === 0 ? 113 : 207, 200));
        floater(root, '✨', p.x, p.y, { dy: -40 });
        dino.wear(i === 0 ? 'chocL' : 'chocR', false);
      };
      break;
    }

    case 'honey': {
      s.expect = (i) => { dino.wear('honey', i === 0); dino.wear('crumb', i === 1); };
      s.stepDone = (i) => {
        const p = local(root, dino.toClient(160, i === 0 ? 168 : 240));
        floater(root, i === 0 ? '🍯' : '🍪', p.x, p.y, { dy: -50, size: 26 });
      };
      break;
    }

    case 'icecream': {
      const scoops = ['#FF9EB5', '#9BE3C3', '#8B5A3C'].map((c) => {
        const el = h('div', { class: 'scoop' });
        el.style.background = c;
        return el;
      });
      const cone = h('div', { class: 'icecream' }, h('div', { class: 'scoops' }, scoops.slice().reverse()), h('div', { class: 'cone' }));
      root.append(cone);
      s.stepDone = (i) => {
        if (i !== 0) return;
        cone.animate([{ rotate: '0deg' }, { rotate: '-6deg' }, { rotate: '4deg' }, { rotate: '0deg' }], { duration: 380 });
        const r = cone.getBoundingClientRect(), sr = root.getBoundingClientRect();
        floater(root, 'slurp!', r.left - sr.left + r.width / 2, r.top - sr.top, { cls: 'word', dy: -40 });
      };
      s.rep = (n) => {
        const left = 1 - n / total;
        scoops.forEach((sc, i) => {
          const share = clamp(left * 3 - i);
          sc.style.transform = `scale(${0.25 + share * 0.75})`;
          sc.style.opacity = share <= 0.02 ? '0' : '1';
        });
      };
      break;
    }

    case 'horse': {
      const t = track(root, '🐎', '🏡');
      t.set(0);
      s.rep = (n) => { t.set(n / total); t.hop(); };
      break;
    }
    case 'tractor':
    case 'moto':
    case 'mouse': {
      const t = track(root, id === 'tractor' ? '🚜' : id === 'moto' ? '🏍️' : '🐁', id === 'mouse' ? '🧀' : '🏁');
      t.set(0);
      let reps = 0;
      s.rep = (n) => { reps = n; t.set(n / total); t.hop(); };
      s.level = (x) => { t.set((reps + clamp(x) * 0.9) / total); t.go(x > 0.01); };
      break;
    }

    case 'kisses': {
      const sun = h('span', { class: 'prop sun' }, '☀️');
      root.append(sun);
      s.stepDone = (i) => {
        const m = mouth();
        if (i === 0) {
          for (let k = 0; k < 3; k++) setTimeout(() => floater(root, '💗', m.x + (k - 1) * 18, m.y - 10, { dx: (k - 1) * 30, dy: -110 }), k * 90);
        } else {
          sun.animate([{ scale: '1' }, { scale: '1.5', rotate: '25deg' }, { scale: '1' }], { duration: 600 });
          floater(root, '✨', m.x - 60, m.y - 40, { dy: -40 });
          floater(root, '✨', m.x + 60, m.y - 40, { dy: -40 });
        }
      };
      break;
    }

    case 'grandpa': {
      dino.wear('glasses', true);
      const vovo = h('span', { class: 'prop vovo' }, '👵');
      root.append(vovo);
      s.stepDone = (i) => {
        if (i !== 0) return;
        const m = mouth();
        const v = vovo.getBoundingClientRect(), r = root.getBoundingClientRect();
        floater(root, '💋', m.x, m.y, { dx: v.left - r.left - m.x + v.width / 2, dy: v.top - r.top - m.y, dur: 900 });
      };
      break;
    }

    case 'balloon': {
      const b = h('span', { class: 'prop balloon' }, '🎈');
      root.append(b);
      let hue = 0;
      s.hold = (p, i) => { if (i === 0) b.style.transform = `translate(-50%,-50%) scale(${0.55 + p * 1.1})`; };
      s.stepDone = (i) => {
        if (i !== 0) return;
        sfx.play('boing');
        const a = b.animate([{ transform: b.style.transform, opacity: 1 }, { transform: 'translate(-50%,-260%) scale(1.4)', opacity: 0 }], { duration: 900, easing: 'ease-in' });
        a.onfinish = () => {
          hue = (hue + 70) % 360;
          b.style.filter = `hue-rotate(${hue}deg)`;
          b.style.transform = 'translate(-50%,-50%) scale(.55)';
        };
      };
      break;
    }

    case 'night': {
      root.append(h('span', { class: 'prop moon' }, '🌙'), h('span', { class: 'prop stars' }, '✨'));
      dino.wear('cap', true);
      dino.idle = false;
      s.stepDone = () => {
        const m = mouth();
        floater(root, 'Z', m.x + 50, m.y - 70, { cls: 'zzz', dy: -60, dx: 30, dur: 1600 });
        setTimeout(() => floater(root, 'z', m.x + 70, m.y - 90, { cls: 'zzz', dy: -60, dx: 30, dur: 1600 }), 400);
      };
      break;
    }

    case 'flowerCake': {
      const candles = Math.min(total, 10);
      const flower = h('div', { class: 'flower' },
        h('div', { class: 'bloom' }, ...[0, 1, 2, 3, 4].map((i) => h('i', { style: `--i:${i}` }))),
        h('div', { class: 'stem' }));
      const flames = Array.from({ length: candles }, () => h('i', { class: 'flame' }));
      const cake = h('div', { class: 'cake' },
        h('div', { class: 'candles' }, ...flames.map((f) => h('span', { class: 'candle' }, f))),
        h('div', { class: 'tier' }));
      root.append(flower, cake);
      s.phase = (p) => {
        root.dataset.phase = p;
        s.extra = p === 'smell' ? { blinkL: 1, blinkR: 1 } : { pucker: 0.8 };
        flower.style.setProperty('--open', '0');
      };
      s.hold = (p) => { flower.style.setProperty('--open', String(p)); };
      s.level = (x) => {
        cake.style.setProperty('--wind', String(x));
        s.extra = { pucker: 0.8, blow: x };
      };
      s.rep = (n) => {
        const f = flames[Math.min(candles - 1, Math.floor(((n - 1) / total) * candles))];
        if (f && !f.classList.contains('out')) {
          f.classList.add('out');
          const r = f.getBoundingClientRect(), sr = root.getBoundingClientRect();
          floater(root, '💨', r.left - sr.left, r.top - sr.top, { dy: -50 });
        }
      };
      break;
    }

    case 'gargle': {
      const glass = h('span', { class: 'prop glass' }, '🥛');
      root.append(glass);
      let last = 0;
      s.level = (x) => {
        const now = performance.now();
        if (x > 0.01 && now - last > 160) {
          last = now;
          const m = mouth();
          floater(root, '🫧', m.x + (Math.random() - 0.5) * 50, m.y, { dy: -90, size: 22, dur: 900 });
        }
      };
      break;
    }

    case 'farm':
    case 'king':
    case 'simon':
      break;
  }
  return s;
}
