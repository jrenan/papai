import { DINO_FRIENDS } from '../data/exercises.js';
import { engine } from '../engine/engine.js';
import { featureVector, TCLASS_LABEL, TCLASSES } from '../engine/knn.js';
import { POSES } from '../engine/poses.js';
import { sfx } from '../engine/sfx.js';
import { tts } from '../engine/speech.js';
import { C_DARK, C_RED, C_SKIN, C_TEETH, GH, GW } from '../engine/tongue.js';
import { store } from '../store.js';
import { h, sleep } from '../util.js';
import { Dino } from './dino.js';
import { Mirror } from './mirror.js';

function topBar(title, sub, back) {
  return h('header', { class: 'ex-top' },
    h('button', { class: 'icon-btn', 'aria-label': 'Voltar', onclick: () => back() }, '✕'),
    h('div', { class: 'ex-title' }, h('span', { class: 'ex-cat' }, sub), h('h1', null, title)));
}

const PALETTE = {
  [C_SKIN]: [236, 214, 196], [C_DARK]: [40, 30, 60], [C_TEETH]: [255, 255, 255], [C_RED]: [255, 140, 60],
};

const gridTmp = Object.assign(document.createElement('canvas'), { width: GW, height: GH });

/** Paints the tongue analyzer's classified window (magnified) into a canvas. */
function paintGrid(cv) {
  const t = engine.tracker?.tongue;
  if (!t) return;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(GW, GH);
  for (let i = 0; i < GW * GH; i++) {
    const c = t.ev[i] ? [255, 30, 140] : t.chg[i] ? [80, 220, 230] : PALETTE[t.cls[i]] ?? [200, 200, 200];
    const lip = t.outerRaw[i] && !t.inner[i];
    img.data[i * 4] = c[0];
    img.data[i * 4 + 1] = lip && !t.ev[i] ? c[1] * 0.75 : c[1];
    img.data[i * 4 + 2] = c[2];
    img.data[i * 4 + 3] = t.valid[i] ? 255 : 40;
  }
  // mirror it so it matches what Leo sees
  gridTmp.getContext('2d').putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(-cv.width / GW, 0, 0, cv.height / GH, cv.width, 0);
  ctx.drawImage(gridTmp, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------- detector
export function detectorScreen(root, back) {
  const mirror = new Mirror();
  mirror.overlay = true;
  const grid = h('canvas', { class: 'grid-view', width: String(GW * 4), height: String(GH * 4) });
  const bars = Object.fromEntries(POSES.map((p) => {
    const fill = h('i');
    const row = h('div', { class: 'bar' }, h('span', null, p), h('b', null, fill));
    return [p, { row, fill }];
  }));
  const info = h('pre', { class: 'debug-box static' });
  const audioBox = h('pre', { class: 'debug-box static' }, 'Microfone desligado.');
  const events = h('ol', { class: 'events' });
  const log = (t) => {
    events.prepend(h('li', null, `${new Date().toLocaleTimeString()} ${t}`));
    while (events.children.length > 12) events.lastChild?.remove();
  };
  const micBtn = h('button', { class: 'btn-ghost', onclick: async () => {
    try {
      await engine.startMic();
      micBtn.hidden = true;
    } catch (e) {
      audioBox.textContent = `Microfone: ${(e).message}`;
    }
  } }, '🎤 Ligar microfone');

  root.replaceChildren(h('div', { class: 'screen tools-screen' },
    topBar('Testar o detector', 'Área dos pais', back),
    h('div', { class: 'page tools-page' },
      h('div', { class: 'tools-grid' },
        h('div', { class: 'mirror-wrap' }, mirror.el),
        h('div', null, h('p', { class: 'muted' }, 'Janela da boca: rosa = língua detectada, ciano = mudou desde o espelho mágico, laranja = vermelho (lábios), azul-escuro = boca aberta, branco = dentes.'), grid, info)),
      h('section', { class: 'panel' }, h('h2', null, 'Poses (0 a 1, ● = ativa)'), h('div', { class: 'bars' }, Object.values(bars).map((b) => b.row))),
      h('section', { class: 'panel' }, h('h2', null, 'Som'), micBtn, audioBox, events))));

  let n = 0;
  const off = engine.onFrame((f, p) => {
    for (const k of POSES) {
      const b = bars[k];
      b.fill.style.width = `${p.score[k] * 100}%`;
      b.row.classList.toggle('on', p.is(k));
    }
    if (++n % 3 === 0) {
      paintGrid(grid);
      const t = f.tongue, m = f.m;
      info.textContent = !f.present ? 'Sem rosto' : [
        `qualidade: ${f.quality} · fps ${engine.tracker?.fps.toFixed(0)} · ${p.usingKnn ? 'modelo do Leo' : 'detector de cor'}`,
        m ? `boca: largura ${m.mouthW.toFixed(2)} abertura ${m.openIn.toFixed(3)} lábios ${(m.upperLip + m.lowerLip).toFixed(3)} bochechas ${m.cheekW.toFixed(3)}` : '',
        t ? `língua: dentro ${t.insideRed.toFixed(2)} fora ↑${t.outUp.toFixed(3)} ↓${t.outDown.toFixed(3)} ⬅${t.outLeft.toFixed(3)} ➡${t.outRight.toFixed(3)}` : '',
        t ? `centro cu ${t.cu.toFixed(2)} cv ${t.cv.toFixed(2)} · contraste lábio/pele ${t.contrast.toFixed(1)}${t.contrast < 6 ? ' (pouca luz?)' : ''}` : '',
        `jawOpen ${(f.bs.jawOpen ?? 0).toFixed(2)} pucker ${(f.bs.mouthPucker ?? 0).toFixed(2)} smile ${(((f.bs.mouthSmileLeft ?? 0) + (f.bs.mouthSmileRight ?? 0)) / 2).toFixed(2)} cheekPuff ${(f.bs.cheekPuff ?? 0).toFixed(2)} roll ${(((f.bs.mouthRollUpper ?? 0) + (f.bs.mouthRollLower ?? 0)) / 2).toFixed(2)}`,
      ].join('\n');
      const a = engine.audio;
      if (a.running) {
        audioBox.textContent = [
          `nível ${a.levelDb.toFixed(0)} dB · ruído ${a.noiseDb.toFixed(0)} dB · ${a.active ? 'SOM' : 'silêncio'}`,
          `voz ${a.pitch.toFixed(2)} ${a.voiced ? '● voz' : ''}${a.blowing ? '● sopro' : ''}  vibração ${a.mod.toFixed(2)} ${a.trilling ? '● vibrando' : ''}`,
        ].join('\n');
      }
    }
  });
  const offs = [
    off,
    engine.audio.onClick(() => log('estalo 🐴')),
    engine.audio.onSegment((s) => log(`som ${Math.round(s.dur)} ms · sopro ${(s.blowFrac * 100).toFixed(0)}% · voz ${(s.voiceFrac * 100).toFixed(0)}% · vibração ${(s.trillFrac * 100).toFixed(0)}%`)),
  ];
  engine.startCamera().catch((e) => { info.textContent = `Câmera: ${(e).message}`; });
  return () => { offs.forEach((o) => o()); mirror.destroy(); };
}

// ---------------------------------------------------------------- train
const CLASS_FACE = {
  rest: { smile: 0.2 },
  aberta: { jaw: 0.6 },
  fora: { jaw: 0.4, tongue: 'out' },
  esq: { jaw: 0.3, tongue: 'left' },
  dir: { jaw: 0.3, tongue: 'right' },
  cima: { jaw: 0.45, tongue: 'up' },
  baixo: { jaw: 0.45, tongue: 'down' },
};
const CLASS_SAY = {
  rest: 'Boca fechadinha.', aberta: 'Abre a boca, com a língua lá dentro.', fora: 'Língua pra fora!',
  esq: 'Língua pro cantinho, deste lado.', dir: 'Língua pro outro cantinho.', cima: 'Língua pra cima, no nariz!', baixo: 'Língua pra baixo, no queixo!',
};

export function trainScreen(root, back) {
  let alive = true;
  let recording = null;
  const knn = engine.knn;
  const mirror = new Mirror();
  const dino = new Dino();
  const status = h('p', { class: 'cal-status' }, 'Escolha uma posição e toque em Gravar. O Leo faz a posição por 3 segundos.');
  const counts = {};
  const probs = {};
  const list = h('ul', { class: 'train-list' }, TCLASSES.map((c) => {
    counts[c] = h('span', { class: 'count' }, String(knn.count(c)));
    const fill = h('i');
    probs[c] = fill;
    return h('li', null,
      h('span', { class: 'train-name' }, TCLASS_LABEL[c]),
      counts[c],
      h('b', { class: 'prob' }, fill),
      h('button', { class: 'btn-go small', onclick: () => record(c) }, 'Gravar'));
  }));
  const refresh = () => { for (const c of TCLASSES) counts[c].textContent = String(knn.count(c)); };

  root.replaceChildren(h('div', { class: 'screen tools-screen' },
    topBar('Ensinar a língua do Leo', 'Área dos pais', back),
    h('div', { class: 'page tools-page' },
      h('div', { class: 'tools-grid' }, h('div', { class: 'mirror-wrap' }, mirror.el), h('div', { class: 'cal-dino' }, dino.el)),
      status,
      h('p', { class: 'muted' }, 'Grave pelo menos "Boca fechada", "Língua para fora" e as posições dos exercícios que ele faz. A barra mostra, ao vivo, o que o modelo acha. Dá para gravar de novo a mesma posição para somar exemplos (ex.: com outra luz).'),
      list,
      h('div', { class: 'done-row' },
        h('button', { class: 'btn-ghost', onclick: () => { knn.clear(); refresh(); status.textContent = 'Treino apagado. Voltando ao detector automático.'; } }, 'Apagar treino')))));

  async function record(c) {
    if (recording) return;
    recording = c;
    dino.set(CLASS_FACE[c]);
    tts.say(CLASS_SAY[c]);
    for (const n of [3, 2, 1]) {
      status.textContent = `${TCLASS_LABEL[c]} em ${n}…`;
      await sleep(800);
      if (!alive) return;
    }
    knn.clearClass(c);
    status.textContent = `Gravando: ${TCLASS_LABEL[c]}…`;
    sfx.play('tick');
    const t0 = performance.now();
    let got = 0;
    const off = engine.onFrame((f) => {
      if (!f.present || f.quality !== 'ok') return;
      const v = featureVector(f);
      if (v) { knn.add(c, v); got++; }
    });
    while (performance.now() - t0 < 3000 && alive) await sleep(100);
    off();
    knn.finalize();
    knn.save();
    refresh();
    sfx.play('rep');
    status.textContent = got ? `Pronto: ${got} quadros de "${TCLASS_LABEL[c]}".` : 'Não vi o rosto. Tente de novo com mais luz.';
    dino.set({ smile: 0.6 });
    recording = null;
  }

  const off = engine.onFrame((f) => {
    if (!knn.ready() || !f.present) return;
    const p = knn.predict(f);
    for (const c of TCLASSES) probs[c].style.width = `${p[c] * 100}%`;
  });
  engine.startCamera().catch((e) => { status.textContent = `Câmera: ${(e).message}`; });
  return () => { alive = false; off(); mirror.destroy(); dino.destroy(); };
}

// ---------------------------------------------------------------- album
export function albumScreen(root, back) {
  const st = store.progress.stickers;
  const friends = Math.floor(store.progress.fullDays.length / 5);
  const fmt = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  root.replaceChildren(h('div', { class: 'screen album' },
    topBar('Meu álbum', `${st.length} figurinhas`, back),
    h('div', { class: 'page' },
      h('h2', { class: 'nb-title' }, 'Amigos do Dino:'),
      h('p', { class: 'muted' }, 'A cada 5 treinos completos, um ovo choca!'),
      h('div', { class: 'friends' },
        DINO_FRIENDS.map((f, i) => i < friends
          ? h('div', { class: 'friend' }, h('span', { class: 'sticker big' }, f.e), h('b', null, f.name))
          : h('div', { class: 'friend locked' }, h('span', { class: 'sticker big' }, '🥚'), h('b', null, '???')))),
      h('h2', { class: 'nb-title' }, 'Figurinhas:'),
      st.length
        ? h('div', { class: 'sticker-grid' }, st.slice().reverse().map((s, i) => h('div', { class: 'slot-sticker', style: `--r:${((i * 37) % 9) - 4}deg` }, h('span', { class: 'sticker' }, s.e), h('small', null, fmt(s.at)))))
        : h('p', { class: 'muted' }, 'Termine um exercício para ganhar a primeira figurinha!'))));
  return () => {};
}
