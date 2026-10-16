const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const playerSource = fs.readFileSync(path.join(__dirname, '../assets/narration-player.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const wrapperSource = fs.readFileSync(path.join(__dirname, '../numberblocks-1-100/game-voice.js'), 'utf8');
const clips = [
  { id: 'a', text: 'Isso!', file: 'a.mp3' },
  { id: 'b', text: 'vinte e três', file: 'b.mp3' },
  { id: 'c', text: 'mais', file: 'c.mp3' },
  { id: 'd', text: 'dois', file: 'd.mp3' },
  { id: 'e', text: 'vinte e três mais', file: 'e.mp3' },
  { id: 'f', text: 'Olá, jardim!', file: 'f.mp3' },
];
function environment({ manifest = { version: 7, clips }, fetch, scriptURL = 'https://example.org/trio/assets/narration-player.js?v=test1' } = {}) {
  const listeners = new Map(), media = [], requests = [], storage = new Map();
  function on(name, handler) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(handler); }
  function emit(event) { for (const handler of listeners.get(event.type) || []) handler(event); }
  class Audio {
    constructor() { this.src = ''; this.plays = []; this.pauses = 0; media.push(this); }
    setAttribute() {}
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    pause() { this.pauses++; }
    load() {}
    play() { this.plays.push(this.src); return this.nextPlay ? this.nextPlay() : Promise.resolve(); }
  }
  const document = { baseURI: scriptURL, currentScript: { src: scriptURL }, hidden: false, addEventListener: on, querySelectorAll: () => [], querySelector: () => null };
  const context = { URL, Audio, document, console, setTimeout, clearTimeout, localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }, CustomEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
    fetch: (...args) => { requests.push(args); return fetch ? fetch(...args) : Promise.reject(new Error('unexpected fetch')); },
    addEventListener: on, dispatchEvent: emit,
  };
  context.window = context;
  if (manifest) context.TRIO_NARRATION_MANIFEST = manifest;
  vm.createContext(context);
  vm.runInContext(playerSource, context);
  return { context, player: context.TrioNarration, media, emit, requests, storage };
}
const ids = value => Array.from(value);
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const e = environment();
  assert.equal(e.player.getState().ready, true);
  assert.equal(e.media.length, 0, 'metadata must not create or download every audio');
  assert.deepEqual(ids(e.player.resolve(' Ola\u0301,  jardim! ')), ['f'], 'exact lookup normalizes NFC and whitespace');
  assert.deepEqual(ids(e.player.resolve('ISSO! Vinte e três, mais dois.')), ['a', 'e', 'd'], 'composition minimizes clips and preserves every word');
  assert.deepEqual(ids(e.player.resolve('Isso! vinte e três palavras ausentes dois.')), [], 'unknown words must reject the entire narration');
  assert.equal(await e.player.speak('Olá, jardim!'), true);
  assert.equal(e.media.length, 1, 'one reusable media element');
  assert.equal(e.media[0].src, 'https://example.org/trio/assets/narration/f.mp3?v=7', 'base path and manifest cache version');
  assert.equal(e.requests.length, 0, 'preloaded metadata needs no fetch');
  await e.player.speak('Isso! vinte e três mais dois.', { rate: .82 });
  assert.equal(e.media[0].playbackRate, .82);
  const staleEnded = e.media[0].onended;
  assert.match(e.media[0].src, /a\.mp3/);
  e.media[0].onended();
  assert.match(e.media[0].src, /e\.mp3/);
  const cancelledCompletion = e.player.finished();
  e.player.stop();
  assert.equal(await cancelledCompletion, false, 'mute/navigation releases game counting waiters');
  const stoppedPlays = e.media[0].plays.length;
  staleEnded();
  assert.equal(e.media[0].plays.length, stoppedPlays, 'a saved completion callback cannot resume after cancellation');
  await e.player.speak('dois');
  const completed = e.player.finished();
  e.media[0].onended();
  assert.equal(await completed, true, 'natural playback completion releases game counting');
  await e.player.speak('dois');
  e.context.document.hidden = true;
  e.emit({ type: 'visibilitychange' });
  assert.equal(e.media[0].src, '', 'backgrounding clears active source');
  assert.equal(await e.player.speak('dois'), false, 'hidden document cannot restart speech');
  e.context.document.hidden = false;
  await e.player.speak('dois');
  e.emit({ type: 'pagehide' });
  assert.equal(e.media[0].src, '', 'navigation stops playback');
  await e.player.speak('palavra não gerada');
  assert.equal(e.player.getState().status, 'error');
  assert.match(e.player.getState().error, /não está disponível/);

  const delayed = environment({ manifest: null, fetch: () => new Promise(resolve => { delayed.finishFetch = resolve; }) });
  const pending = delayed.player.speak('dois');
  await flush();
  delayed.player.stop();
  delayed.finishFetch({ ok: true, json: async () => ({ version: '9', clips }) });
  assert.equal(await pending, false, 'stop invalidates utterance waiting for manifest');
  assert.equal(delayed.media[0].plays.filter(url => url.endsWith('.mp3?v=9')).length, 0);
  assert.match(String(delayed.requests[0][0]), /manifest\.json\?v=test1$/);

  const stale = environment();
  stale.player.unlock();
  await flush();
  let rejectOld;
  stale.media[0].nextPlay = () => new Promise((_, reject) => { rejectOld = reject; });
  await stale.player.speak('dois');
  stale.media[0].nextPlay = null;
  await stale.player.speak('mais');
  rejectOld(Object.assign(new Error('old playback failed'), { name: 'NotAllowedError' }));
  await flush();
  assert.equal(stale.player.getState().status, 'playing', 'an obsolete play promise cannot overwrite new state');
  stale.media[0].nextPlay = () => Promise.reject(Object.assign(new Error('gesture needed'), { name: 'NotAllowedError' }));
  await stale.player.speak('dois');
  await flush();
  assert.match(stale.player.getState().error, /liberar o áudio/, 'autoplay denial offers explicit retry');

  const local = environment({ scriptURL: 'file:///tmp/site/assets/narration-player.js?v=1' });
  await local.player.speak('dois');
  assert.equal(local.media[0].src, 'file:///tmp/site/assets/narration/d.mp3?v=7');

  const wrapper = environment();
  wrapper.storage.set('triodosaber.blockvoice.v1', JSON.stringify({ voiceURI: 'old-device-voice', rate: .82 }));
  vm.runInContext(wrapperSource, wrapper.context);
  assert.equal(wrapper.context.BlockVoice.getSettings().voiceURI, 'jessica-eleven-v4', 'old system voice preference migrates to Jessica');
  assert.equal(wrapper.context.BlockVoice.getSettings().rate, .82);
  await wrapper.context.BlockVoice.speak('dois');
  assert.equal(wrapper.media[0].playbackRate, .82);
  wrapper.context.BlockVoice.stop();
  assert.equal(wrapper.media[0].src, '');
  const announcement = { textContent: 'Instrução atual.' };
  wrapper.context.document.querySelector = selector => selector === '#announcement' ? announcement : null;
  await wrapper.context.BlockVoice.speak('narração ausente');
  await flush();
  assert.match(announcement.textContent, /não está disponível/, 'new playback errors announce even when focus remains on a block');

  const spoken = [], stops = [];
  const app = { window: { TrioNarration: { speak: text => spoken.push(text), stop: () => stops.push(true) }, scrollTo() {} },
    currentSpecies: () => ({ name: 'tatu' }), withArticle: () => 'o tatu', currentMission: () => ({ story: 'O tatu procura sua casa.' }),
    feedback: { classList: { contains: () => true } }, getSelectedCountry: () => ({ name: 'Brasil', music: 'Ritmos brasileiros.' }),
    show() {}, hide() {}, resetRescueInteraction() {}, gameHub: {}, worldGame: {}, biomeScreens: [],
  };
  vm.createContext(app);
  for (const [start, end] of [['function speakCurrentPrompt()', 'function formatNumber'], ['function speakCountryMusic()', 'function updateNarrationControls'], ['function openHub()', 'function openBiomes']]) {
    vm.runInContext(appSource.slice(appSource.indexOf(start), appSource.indexOf(end)), app);
  }
  app.speakCurrentPrompt(); app.speakCountryMusic(); app.openHub();
  assert.match(spoken[0], /^Ajude o tatu\. O tatu procura sua casa\./);
  assert.equal(spoken[1], 'Brasil. Ritmos brasileiros.');
  assert.equal(stops.length, 1, 'returning to hub stops narration');
  for (const file of ['app.js', 'numberblocks-1-100/game-voice.js', 'numberblocks-1-100/blocos-de-somar.html', 'numberblocks-somar/index.html']) {
    assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), /speechSynthesis|SpeechSynthesisUtterance/, 'active surfaces must not fall back to system voice');
  }
  console.log('PASS narration runtime: exact/composed coverage, lazy media, cache paths, cancellation, visibility, stale promises, autoplay, settings migration and app calls');
})().catch(error => { console.error(error); process.exitCode = 1; });
