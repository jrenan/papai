import { CATS, EX } from '../data/exercises.js';
import { store } from '../store.js';
import { h, onLongPress } from '../util.js';
import { Dino } from './dino.js';

/** The notebook's own wording, without the "10X" (shown apart); long notes fall back to the short name. */
function cardText(notebook, name) {
  const t = notebook.replace(/\s*\b\d+X\b/gi, '').replace(/\s*·\s*/g, ' · ').trim();
  return t.length > 48 ? name.toUpperCase() : t;
}

export function homeScreen(root, nav) {
  const today = store.today();
  const ids = store.routineIds();
  const doneN = ids.filter((id) => today[id]?.done).length;
  const allDone = ids.length > 0 && doneN === ids.length;
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');

  const dino = new Dino();
  dino.set({ smile: allDone ? 1 : 0.6, jaw: allDone ? 0.3 : 0.1 });

  const hero = h('section', { class: 'hero' },
    h('div', { class: 'hero-dino' }, dino.el),
    h('p', { class: 'bubble' }, allDone ? 'Treino de hoje completo! Você é demais, Leo! 🎉' : doneN ? `Já fizemos ${doneN}! Bora continuar?` : 'Oi, Leo! Vamos treinar a boca hoje?'),
    h('button', { class: 'btn-go big hero-go', onclick: () => nav.startRoutine() }, allDone ? 'Treinar de novo ▶' : doneN ? 'Continuar treino ▶' : 'Treino de hoje ▶'),
    h('div', { class: 'today-stars', 'aria-label': `${doneN} de ${ids.length} exercícios feitos hoje` },
      ids.map((id) => h('span', { class: today[id]?.done ? 'on' : '' }, '★'))));

  // notebook sections, in the order the parent set
  const order = store.settings.routine.map((r) => r.id);
  const groups = [];
  for (const id of order) {
    const ex = EX[id];
    const key = ex.cat;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.ids.push(id);
    else groups.push({ key, cat: ex.cat, ids: [id] });
  }

  const card = (id) => {
    const ex = EX[id];
    const r = store.settings.routine.find((x) => x.id === id);
    const done = !!today[id]?.done;
    return h('button', { class: 'ex-card' + (done ? ' done' : '') + (r && !r.on ? ' off' : ''), onclick: () => nav.startOne(id) },
      h('span', { class: 'ex-emoji' }, ex.emoji),
      h('span', { class: 'ex-name' }, cardText(ex.notebook, ex.name)),
      h('span', { class: 'ex-times' }, `${store.repsFor(id)}X`),
      done ? h('span', { class: 'stamp small' }, 'FEITO') : null,
      r && !r.on ? h('span', { class: 'off-tag' }, 'fora do treino') : null);
  };

  const sections = groups.map((g) => {
    const c = CATS[g.cat];
    return h('section', { class: `nb-section cat-${g.cat}` },
      h('h2', { class: 'nb-title' }, `${c.title}:`),
      c.sub ? h('h3', { class: 'nb-sub' }, `${c.sub.toUpperCase()}:`) : null,
      h('div', { class: 'ex-grid' }, g.ids.map(card)));
  });

  const fullDays = store.progress.fullDays.length;
  const eggStep = fullDays % 5;
  const gear = h('button', { class: 'gear', 'aria-label': 'Área dos pais: segure 2 segundos' }, h('span', { class: 'gear-fill' }), '⚙︎');
  onLongPress(gear, 1800, () => nav.parent(), (p) => gear.style.setProperty('--p', String(p)));

  root.replaceChildren(h('div', { class: 'screen home' },
    h('div', { class: 'page' },
      h('div', { class: 'page-top' },
        h('a', { class: 'site-link', href: '../index.html' }, '← Trio do Saber'),
        h('div', { class: 'dateline' }, h('span', null, `${p2(d.getDate())}`), h('i'), h('span', null, `${p2(d.getMonth() + 1)}`), h('i'), h('span', null, String(d.getFullYear()).slice(2)))),
      h('h1', { class: 'nb-hand' }, 'Fono do Leo'),
      hero,
      ...sections,
      h('section', { class: 'nb-section cat-jogo' },
        h('h2', { class: 'nb-title' }, '"Caretas com o dinossauro"'),
        h('button', { class: 'game-card', onclick: () => nav.startOne('caretas') },
          h('span', { class: 'ex-emoji' }, '🦕'),
          h('span', null, h('b', null, 'Jogo das caretas'), h('small', null, 'O Dino faz a careta, você copia!')),
          h('span', { class: 'go' }, '▶'))),
      h('section', { class: 'album-row' },
        h('button', { class: 'album-btn', onclick: () => nav.album() },
          h('span', { class: 'album-stack' }, store.progress.stickers.slice(-3).map((s) => h('span', { class: 'sticker' }, s.e))),
          h('span', null, h('b', null, 'Meu álbum'), h('small', null, `${store.progress.stickers.length} figurinhas`))),
        h('div', { class: 'egg-box', title: 'Complete 5 treinos para chocar um ovo' },
          h('span', { class: `egg-big crack-${eggStep}` }, '🥚'),
          h('small', null, `${eggStep}/5 treinos`))),
      h('footer', { class: 'home-foot' }, gear, h('small', null, 'Área dos pais: segure ⚙︎')),
    )));

  return () => dino.destroy();
}
