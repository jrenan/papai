import { Calibrator } from '../engine/calibration.js';
import { engine } from '../engine/engine.js';
import { sfx } from '../engine/sfx.js';
import { tts } from '../engine/speech.js';
import { store } from '../store.js';
import { h } from '../util.js';
import { Dino } from './dino.js';
import { Mirror } from './mirror.js';

/**
 * "Espelho mágico": about two seconds of Leo's relaxed face with the mouth
 * closed. Gives the detector his neutral lip width, lip thickness, cheek
 * width and what the tongue detector sees at rest.
 */
export function calibrateScreen(root, onDone, onBack) {
  let alive = true;
  const cal = new Calibrator();
  const mirror = new Mirror();
  const dino = new Dino();
  dino.set({ smile: 0.3 });
  const status = h('p', { class: 'cal-status' }, 'Preparando o espelho…');
  const bar = h('i');
  const skip = h('button', { class: 'btn-ghost', hidden: true, onclick: () => done(false) }, 'Continuar sem ajustar');
  root.replaceChildren(h('div', { class: 'screen cal-screen' },
    h('header', { class: 'ex-top' },
      h('button', { class: 'icon-btn', 'aria-label': 'Voltar', onclick: () => onBack() }, '✕'),
      h('div', { class: 'ex-title' }, h('span', { class: 'ex-cat' }, 'Antes de começar'), h('h1', null, 'Espelho mágico'))),
    h('div', { class: 'cal-main' },
      h('div', { class: 'cal-dino' }, dino.el),
      h('div', { class: 'mirror-wrap cal-mirror' }, mirror.el, h('div', { class: 'oval-guide' })),
      h('div', { class: 'cal-progress' }, bar),
      status,
      skip),
  ));

  let lastMsg = '';
  const say = (m) => { if (m !== lastMsg) { lastMsg = m; status.textContent = m; } };

  const off = engine.onFrame((f) => {
    if (!alive || cal.done()) return;
    const why = cal.push(f);
    if (why === null) engine.tracker?.tongue.addRestFrame();
    bar.style.width = `${cal.progress * 100}%`;
    if (why === 'none') say('Olha pro espelho! 👀');
    else if (why === 'far') say('Chega mais perto do celular 🔍');
    else if (why === 'turned') say('Olha bem pra frente 🙂');
    else if (why === 'open') say('Fecha a boquinha 🤐');
    else say('Isso! Fica paradinho…');
    if (cal.done()) done(true);
  });

  const t = window.setTimeout(() => { if (alive) skip.hidden = false; }, 15000);

  function done(ok) {
    if (!alive) return;
    alive = false;
    off();
    if (ok) {
      store.saveBaseline(cal.result());
      const t = engine.tracker?.tongue;
      if (t?.endRest() && t.rest) store.saveRest(t.rest);
      sfx.play('sparkle');
      dino.set({ smile: 1, jaw: 0.3 });
      say('Pronto! O Dino conhece você 🦕');
      tts.say('Pronto!');
      setTimeout(onDone, 900);
    } else {
      onDone();
    }
  }

  (async () => {
    try {
      await engine.startCamera();
      engine.tracker?.tongue.beginRest();
      if (alive) {
        say('Olha pro espelho com a boca fechadinha 🤐');
        tts.say('Olha pro espelho, com a boca fechadinha.');
      }
    } catch (e) {
      say(`Não consegui abrir a câmera: ${(e).message || e}`);
      skip.hidden = false;
    }
  })();

  return () => {
    alive = false;
    off();
    clearTimeout(t);
    mirror.destroy();
    dino.destroy();
  };
}

/** Recalibrate when there is no baseline or it is from an earlier session (light changes). */
export function needsCalibration() {
  const b = store.baseline;
  return !b || Date.now() - b.at > 30 * 60 * 1000;
}
