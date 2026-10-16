const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../numberblocks-somar/index.html'), 'utf8');
const counting = source.slice(source.indexOf('let countingRevision = 0;'), source.indexOf('/* etapa 4:'));
const buildCompletion = source.slice(source.indexOf('async function completeBuild(){'), source.indexOf('/* etapa 3:'));
const dock = source.slice(source.indexOf('function dockHTML(){'), source.indexOf('/* ---------- chão e personagens'));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup({ muted = false, immediate = false } = {}) {
  let modal = false, currentAudio = deferred(), finishedCalls = 0, stopCalls = 0, renders = 0, transitions = 0;
  const timers = [];
  const S = { screen: 'game', step: 3, pid: 1, sound: !muted, joined: true, busy: false, countDone: false, counted: [], c: 3 };
  const context = { S, Promise, reduced: true, document: { hidden: false, querySelector: () => modal ? {} : null },
    window: { BlockVoice: { finished: () => { finishedCalls++; return currentAudio.promise; }, stop: () => { stopCalls++; currentAudio.resolve(false); } } },
    sleep: () => { if (immediate) return Promise.resolve(); const wait = deferred(); timers.push(wait); return wait.promise; },
    renderDock: () => { renders++; }, setMsg() {}, jump() {}, $: () => ({}),
    enterStep: n => { transitions++; S.step = n; },
    countBlock: i => { S.counted.push(i); currentAudio = deferred(); if (S.counted.length === S.c) context.finishCount(); return true; },
  };
  vm.createContext(context); vm.runInContext(counting + '\n' + dock, context);
  return { context, S, setModal: value => { modal = value; }, audio: () => currentAudio,
    releaseTimers: () => { for (const timer of timers.splice(0)) timer.resolve(); },
    stats: () => ({ finishedCalls, stopCalls, renders, transitions }),
  };
}
function setupBuild({ muted = false } = {}) {
  let modal = false, finishedCalls = 0, renders = 0, focused = 0, idles = 0;
  const voice = deferred(), spoken = [], classes = new Set(['sem-rosto']);
  const S = { screen: 'game', step: 1, pid: 1, sound: !muted, built: false, busy: false };
  const figure = { classList: { remove: name => classes.delete(name), add: (...names) => names.forEach(name => classes.add(name)) },
    querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 10 }) }) };
  const next = { focus: () => { focused++; } };
  const context = { S, Promise, reduced: true, tgt: () => 2, nome: () => 'Dois', blocos: () => 'dois blocos',
    document: { hidden: false, querySelector: () => modal ? {} : null, activeElement: { closest: () => true } },
    window: { BlockVoice: { finished: () => { finishedCalls++; return voice.promise; } } },
    sleep: () => Promise.resolve(), $: selector => selector.includes('data-act') ? next : figure,
    renderDock: () => { renders++; }, setMsg() {}, jump() {}, plim() {}, sfx() {}, setTimeout() {},
    say: text => { if (S.sound) spoken.push(text); }, armIdle: () => { idles++; },
  };
  vm.createContext(context); vm.runInContext(counting + '\n' + buildCompletion + '\n' + dock, context);
  return { context, S, classes, spoken, voice, setModal: value => { modal = value; }, stats: () => ({ finishedCalls, renders, focused, idles }) };
}
(async () => {
  for (const reason of ['modal', 'hidden', 'pagehide']) {
    const e = setup();
    const run = e.context.countWithMe();
    assert.equal(e.S.counted.length, 1);
    if (reason === 'modal') e.setModal(true);
    if (reason === 'hidden') e.context.document.hidden = true;
    e.context.interruptCounting();
    e.context.window.BlockVoice.stop();
    // Even a quickly closed modal/background cycle must not resume old automation.
    e.setModal(false); e.context.document.hidden = false;
    e.releaseTimers(); await run;
    assert.equal(e.S.counted.length, 1, `${reason} must not count a second block`);
    assert.equal(e.S.busy, false);
    assert.equal(e.stats().transitions, 0);
    assert.match(e.context.dockHTML(), /Contar comigo/);
  }
  const interrupted = setup();
  const stoppedLoop = interrupted.context.countWithMe();
  interrupted.audio().resolve(false); // Includes timeout, error, or replacement by Ouvir.
  interrupted.releaseTimers(); await stoppedLoop;
  assert.equal(interrupted.S.counted.length, 1);
  assert.equal(interrupted.S.busy, false, 'failed recording restores a usable dock');
  assert.equal(interrupted.stats().stopCalls, 0, 'old automation must not cancel a newer repeat narration');

  const last = setup();
  last.S.counted = [0, 1, 2];
  const finishing = last.context.finishCount();
  last.setModal(true); last.context.interruptCounting(); last.context.window.BlockVoice.stop();
  last.releaseTimers(); await finishing;
  assert.equal(last.S.countDone, true, 'the last counted block remains counted');
  assert.equal(last.S.busy, false);
  assert.equal(last.stats().transitions, 0, 'no automatic transition behind an exit modal');
  assert.match(last.context.dockHTML(), />Continuar<\/button>/, 'existing dock offers explicit resume after final count');
  assert.doesNotMatch(last.context.dockHTML(), /disabled/, 'resume cannot remain disabled');
  last.setModal(false);
  await last.context.countWithMe();
  last.releaseTimers(); await flush(); last.releaseTimers(); await flush();
  assert.equal(last.stats().transitions, 1, 'explicit Continue resumes the completed count once');
  assert.equal(last.S.step, 4);

  const silent = setup({ muted: true, immediate: true });
  await silent.context.countWithMe(); await flush();
  assert.equal(silent.S.counted.length, 3, 'muted automatic counting still counts every block');
  assert.equal(silent.stats().finishedCalls, 0, 'muted mode never waits on an old cancelled recording');
  assert.equal(silent.stats().transitions, 1);

  const mutedDuring = setup();
  const mutedRun = mutedDuring.context.countWithMe();
  mutedDuring.S.sound = false;
  mutedDuring.context.window.BlockVoice.stop();
  for (let turn = 0; turn < 6; turn++){ mutedDuring.releaseTimers(); await flush(); }
  await mutedRun;
  assert.equal(mutedDuring.S.counted.length, 3, 'muting during a number continues the remaining visual count');
  assert.equal(mutedDuring.stats().transitions, 1);

  const completedBuild = setupBuild();
  const complete = completedBuild.context.completeBuild();
  completedBuild.voice.resolve(true); await complete;
  assert.deepEqual(completedBuild.spoken, ['Eu sou o Dois!']);
  assert.equal(completedBuild.S.busy, false);
  assert.equal(completedBuild.classes.has('vivo'), true);
  assert.match(completedBuild.context.dockHTML(), />Continuar<\/button>/);

  for (const reason of ['cancelled', 'modal', 'hidden', 'pagehide']) {
    const e = setupBuild();
    const run = e.context.completeBuild();
    if (reason === 'modal') e.setModal(true);
    if (reason === 'hidden') e.context.document.hidden = true;
    if (reason !== 'cancelled') e.context.interruptCounting();
    // A fast resume must not resurrect the old "Eu sou" narration.
    e.setModal(false); e.context.document.hidden = false;
    e.voice.resolve(false); await run;
    assert.deepEqual(e.spoken, [], `${reason}: no new narration after interrupted final number`);
    assert.equal(e.S.busy, false, `${reason}: final build must not trap controls`);
    assert.equal(e.classes.has('sem-rosto'), false);
    assert.equal(e.classes.has('vivo'), true, `${reason}: completed figure remains visible`);
    assert.match(e.context.dockHTML(), />Continuar<\/button>/, `${reason}: explicit next action remains available`);
    if (reason !== 'cancelled') {
      assert.equal(e.stats().focused, 0, `${reason}: do not move focus after an interruption`);
      assert.equal(e.stats().idles, 0, `${reason}: do not restart an idle prompt behind the modal/background`);
    }
  }
  const mutedBuild = setupBuild({ muted: true });
  await mutedBuild.context.completeBuild();
  assert.equal(mutedBuild.stats().finishedCalls, 0);
  assert.deepEqual(mutedBuild.spoken, []);
  assert.equal(mutedBuild.S.busy, false);
  assert.equal(mutedBuild.classes.has('vivo'), true);
  assert.match(mutedBuild.context.dockHTML(), />Continuar<\/button>/);

  assert.match(source, /function askLeave\(\)\{\s*interruptCounting\(\)/);
  assert.match(source, /visibilitychange[^]*?if \(document\.hidden\)\{ interruptCounting\(\)/);
  assert.match(source, /addEventListener\('pagehide', interruptCounting\)/);
  console.log('PASS counting narration: modal/background/pagehide cancellation, false/timeout handling, newer speech preserved, final-count resume, completeBuild cancellation and muted visual counting');
})().catch(error => { console.error(error); process.exitCode = 1; });
