import { DINO_FRIENDS, EX } from './data/exercises.js';
import { DEV, LOCAL } from './env.js';
import { engine } from './engine/engine.js';
import { sfx, unlockAudio } from './engine/sfx.js';
import { tts } from './engine/speech.js';
import { store } from './store.js';
import { calibrateScreen, needsCalibration } from './ui/calibrate.js';
import { Dino } from './ui/dino.js';
import { exerciseScreen } from './ui/exercise.js';
import { homeScreen } from './ui/home.js';
import { parentScreen } from './ui/parent.js';
import { albumScreen, detectorScreen, trainScreen } from './ui/tools.js';
import { h, todayKey } from './util.js';

const app = document.getElementById('app');
let cleanup = null;

function show(mount) {
  cleanup?.();
  cleanup = null;
  window.scrollTo(0, 0);
  cleanup = mount(app);
}

tts.init();
tts.enabled = store.settings.voice;
sfx.enabled = store.settings.sfx;
document.body.append(h('div', { id: 'video-holder', 'aria-hidden': 'true' }));

// iOS only lets a page make sound after a tap
const unlock = () => {
  unlockAudio();
  tts.unlock();
  window.removeEventListener('pointerdown', unlock, true);
};
window.addEventListener('pointerdown', unlock, true);

function home() {
  engine.stopMic();
  engine.releaseCameraSoon();
  show((root) => homeScreen(root, { startRoutine, startOne, album, parent }));
}

function withCalibration(next, mic = false) {
  if (!needsCalibration()) return next();
  show((root) => calibrateScreen(root, next, home, { mic }));
}

function startRoutine() {
  const ids = store.routineIds();
  if (!ids.length) return parent();
  const today = store.today();
  let i = ids.findIndex((id) => !today[id]?.done);
  if (i < 0) i = 0;
  const go = () => runAt(ids, i);
  if (ids.some((id) => EX[id].camera)) withCalibration(go, EX[ids[i]].mic);
  else go();
}

function runAt(list, i) {
  if (i >= list.length) return routineDone();
  const ex = EX[list[i]];
  const next = list[i + 1] ? EX[list[i + 1]] : null;
  show((root) => exerciseScreen(root, ex, {
    reps: store.repsFor(ex.id),
    pos: { i, n: list.length },
    nextName: next ? next.name : 'Fim do treino',
    onNext: () => runAt(list, i + 1),
    onHome: home,
    onRepeat: () => runAt(list, i),
  }));
}

function startOne(id) {
  const ex = EX[id];
  const go = () => show((root) => exerciseScreen(root, ex, {
    reps: store.repsFor(id),
    onNext: home,
    onHome: home,
    onRepeat: () => startOne(id),
  }));
  if (ex.camera) withCalibration(go, ex.mic);
  else go();
}

function routineDone() {
  engine.stopMic();
  engine.releaseCameraSoon();
  show((root) => {
    const full = store.progress.fullDays.length;
    const hatched = full > 0 && full % 5 === 0 && store.progress.fullDays[full - 1] === todayKey();
    const friend = DINO_FRIENDS[Math.min(DINO_FRIENDS.length - 1, Math.floor(full / 5) - 1)];
    const left = 5 - (full % 5);
    const dino = new Dino();
    dino.set({ smile: 1, jaw: 0.35 });
    sfx.play('done');
    tts.say(hatched && friend ? `Treino completo! O ovo chocou! Conheça o ${friend.name}!` : 'Treino completo! Parabéns, Leo!');
    root.replaceChildren(h('div', { class: 'screen finale' },
      h('div', { class: 'page' },
        h('h1', { class: 'nb-hand' }, 'Treino completo!'),
        h('div', { class: 'hero-dino' }, dino.el),
        hatched && friend
          ? h('div', { class: 'hatch' }, h('span', { class: 'sticker big' }, friend.e), h('p', null, `O ovo chocou! Conheça o ${friend.name}.`))
          : h('div', { class: 'hatch' }, h('span', { class: `egg-big crack-${full % 5}` }, '🥚'), h('p', null, `Mais ${left} ${left === 1 ? 'treino' : 'treinos'} e o ovo choca!`)),
        h('button', { class: 'btn-go big', onclick: home }, 'Voltar ao caderno'))));
    return () => dino.destroy();
  });
}

function album() {
  show((root) => albumScreen(root, home));
}

function parent() {
  engine.stopMic();
  show((root) => parentScreen(root, {
    back: home,
    detector: () => show((r) => detectorScreen(r, parent)),
    train: () => show((r) => trainScreen(r, parent)),
    calibrate: () => show((r) => calibrateScreen(r, parent, parent)),
  }));
}

// dev shortcuts: ?screen=detector|train|parent|album, ?ex=<exercise id>
const devScreen = DEV ? new URLSearchParams(location.search) : null;
if (devScreen?.get('screen') === 'detector') show((r) => detectorScreen(r, parent));
else if (devScreen?.get('screen') === 'train') show((r) => trainScreen(r, parent));
else if (devScreen?.get('screen') === 'parent') parent();
else if (devScreen?.get('screen') === 'album') album();
else if (devScreen?.get('ex') && EX[devScreen.get('ex')]) startOne(devScreen.get('ex'));
else home();

// offline cache for the published site; skipped locally so edits show up right away
if (!LOCAL && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}

if (DEV) window.engine = engine;
