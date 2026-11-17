const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const voiceSource = fs.readFileSync(path.join(root, 'dia-e-noite/voice.js'), 'utf8');
const lessonSource = fs.readFileSync(path.join(root, 'dia-e-noite/lesson.js'), 'utf8');
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'dia-e-noite/narration-texts.json'), 'utf8'));
const corpusIDs = new Set(corpus.clips.map(clip => clip.id));
assert.equal(corpusIDs.size, corpus.clips.length, 'narration IDs are unique');
const manifest = {
  provider: 'ElevenLabs', available: true,
  clips: Object.fromEntries(corpus.clips.map(clip => [clip.id, { file: clip.file, sha256: `hash-${clip.id}` }])),
};
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function environment({ fetchResponse } = {}) {
  const listeners = new Map(), media = [], requests = [], changes = [], events = [];
  const timers = new Map();
  let now = 0, timerID = 0;
  const on = (name, handler) => listeners.set(name, [...(listeners.get(name) || []), handler]);
  class Audio {
    constructor() { this._src = ''; this.currentTime = 0; this.paused = true; this.plays = []; this.pauses = 0; media.push(this); }
    get src() { return this._src; }
    set src(value) { this._src = value; this.currentTime = 0; events.push(['source', value]); }
    setAttribute() {}
    pause() { this.paused = true; this.pauses++; events.push(['pause']); }
    play() {
      this.paused = false; this.plays.push(this.src); events.push(['play', this.src]);
      return this.nextPlay ? this.nextPlay() : Promise.resolve();
    }
  }
  const document = {
    currentScript: { src: 'https://example.org/trio/dia-e-noite/voice.js?v=test-release' },
    hidden: false, addEventListener: on,
  };
  const context = {
    URL, Audio, document, console, addEventListener: on,
    setTimeout(callback, delay) { const id = ++timerID; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch(url) {
      requests.push(String(url));
      return fetchResponse ? fetchResponse(url, requests.length) : Promise.resolve({ ok: true, json: async () => manifest });
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(voiceSource, context, { filename: 'voice.js' });
  const voice = context.DayNightVoice.create(value => changes.push({ ...value }));
  return {
    voice, media, requests, changes, events, document,
    emit(name) { for (const callback of listeners.get(name) || []) callback(); },
    tick(duration) {
      const end = now + duration;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at).find(([, timer]) => timer.at <= end);
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].callback();
      }
      now = end;
    },
  };
}

// A small DOM adapter runs the real lesson state machine without a browser or network.
function lessonEnvironment() {
  const calls = [], handlers = {};
  const element = () => ({ dataset: {}, textContent: '', focus() {}, setAttribute(name, value) { this[name] = value; } });
  const nodes = { '#lessonTitle': element(), '#lessonFeedback': element(), '.lesson-copy': element() };
  let buttons = [];
  const panel = {
    dataset: {}, hidden: true, addEventListener(name, callback) { handlers[name] = callback; },
    contains(button) { return buttons.includes(button); },
    set innerHTML(html) {
      buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attributes]) => {
        const button = element();
        button.disabled = /\sdisabled(?:\s|$)/.test(attributes);
        button.closest = () => button;
        for (const [, name, value] of attributes.matchAll(/([\w-]+)="([^"]*)"/g)) {
          if (name.startsWith('data-')) button.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
          else button[name] = value;
        }
        return button;
      });
    },
    querySelector(selector) {
      if (nodes[selector]) return nodes[selector];
      if (selector === '#lessonNext') return buttons.find(button => button.id === 'lessonNext');
      const match = selector.match(/^\[data-lesson-(action|answer)="([^"]+)"\]$/);
      return match && buttons.find(button => button.dataset[match[1] === 'action' ? 'lessonAction' : 'lessonAnswer'] === match[2]);
    },
  };
  const startButton = { addEventListener() {} };
  const context = { document: { getElementById: id => id === 'lessonPanel' ? panel : startButton } };
  vm.createContext(context);
  vm.runInContext(lessonSource, context, { filename: 'lesson.js' });
  const lesson = context.DayNightLesson.create({
    speak(id) { assert.ok(corpusIDs.has(id), `emitted lesson ID ${id} has a recorded-text entry`); calls.push(id); },
    stopSpeech() {}, pause() {}, setGuided() {}, setLock() {}, showOtherPlace() {}, setObserver() {}, setAngle() {}, turnToNight() {},
  });
  function click(kind, value) {
    const button = panel.querySelector(`[data-lesson-${kind}="${value}"]`);
    assert.ok(button, `${kind} ${value} is available`);
    handlers.click({ target: button });
  }
  return { lesson, panel, calls, action: value => click('action', value), answer: value => click('answer', value) };
}

const tests = [];
const test = (name, run) => tests.push({ name, run });

test('gesture, one media element, repeat, pause and mute', async () => {
  const e = environment();
  e.voice.speak('lesson-body'); e.voice.schedule('sunrise'); e.tick(1000);
  await flush();
  assert.equal(e.media.length, 1, 'one reusable element is created');
  const audio = e.media[0];
  assert.equal(audio.plays.length, 0, 'loading or requesting narration does not autoplay');
  assert.match(e.requests[0], /audio\/manifest\.json\?v=test-release$/);
  e.voice.enable('lesson-body'); await flush();
  assert.equal(e.voice.getState().status, 'playing');
  assert.equal(e.voice.isSpeaking(), true);
  assert.match(audio.src, /\/trio\/dia-e-noite\/audio\/lesson-body\.mp3\?v=hash-lesson-body$/);
  assert.equal(audio.playbackRate, .96);
  e.voice.speak('lesson-body'); assert.equal(audio.plays.length, 1, 'same ongoing clip is not restarted accidentally');
  audio.currentTime = 8;
  e.voice.speak('lesson-body', { force: true }); await flush();
  assert.equal(audio.plays.length, 2, 'explicit repeat starts the instruction again');
  assert.equal(audio.currentTime, 0);
  e.voice.stop(); assert.equal(audio.paused, true); assert.equal(e.voice.isSpeaking(), false);
  e.voice.enable('lesson-compare'); await flush();
  e.voice.disable(); const plays = audio.plays.length;
  e.voice.speak('lesson-predict'); e.voice.schedule('day'); e.tick(1000);
  assert.equal(audio.plays.length, plays, 'muting cancels future speech');
  assert.equal(e.media.length, 1, 'all transitions reuse the original element');
});

test('rapid changes cancel old playback and stale completion/error promises', async () => {
  const e = environment(); await flush();
  const audio = e.media[0], oldPlay = deferred();
  audio.nextPlay = () => oldPlay.promise;
  e.voice.enable('lesson-body');
  const oldEnded = audio.onended, oldError = audio.onerror;
  audio.nextPlay = null;
  e.voice.speak('lesson-compare'); e.voice.speak('lesson-predict'); await flush();
  oldPlay.reject(Object.assign(new Error('old request'), { name: 'NotAllowedError' }));
  oldEnded(); oldError(); await flush();
  assert.equal(e.voice.getState().clip, 'lesson-predict');
  assert.equal(e.voice.getState().status, 'playing');
  assert.equal(e.voice.getState().enabled, true);
  for (let i = 0; i < e.events.length; i++) {
    if (e.events[i][0] === 'play' && i > 0) assert.equal(e.events[i - 2]?.[0], 'pause', 'previous media is paused before the next source plays');
  }
  assert.equal(e.media.length, 1);
});

test('phase changes debounce and a stop cancels their timer', async () => {
  const e = environment(); await flush(); e.voice.enable('intro'); await flush();
  const audio = e.media[0];
  e.voice.schedule('sunrise'); e.tick(400); e.voice.schedule('day'); e.tick(649);
  assert.equal(audio.plays.length, 1, 'fast phase scrubbing stays quiet');
  e.tick(1); await flush();
  assert.equal(audio.plays.length, 2); assert.match(audio.src, /\/day\.mp3/);
  assert.ok(!audio.plays.some(url => url.includes('/sunrise.mp3')), 'an obsolete phase is never narrated');
  e.voice.schedule('sunset'); e.voice.stop(); e.tick(1000); await flush();
  assert.equal(audio.plays.length, 2, 'stopping cancels the pending phase');
});

test('playback errors support retry and autoplay denial requires another gesture', async () => {
  const e = environment(); await flush(); const audio = e.media[0];
  audio.nextPlay = () => Promise.reject(new Error('network'));
  e.voice.enable('lesson-body'); await flush();
  assert.equal(e.voice.getState().status, 'error'); assert.equal(audio.paused, true);
  audio.nextPlay = null; e.voice.enable('lesson-body'); await flush();
  assert.equal(e.voice.getState().status, 'playing');
  audio.onerror(); assert.equal(e.voice.getState().status, 'error');
  e.voice.enable('lesson-body'); await flush(); assert.equal(e.voice.isSpeaking(), true);
  audio.nextPlay = () => Promise.reject(Object.assign(new Error('gesture'), { name: 'NotAllowedError' }));
  e.voice.speak('lesson-compare'); await flush();
  assert.equal(e.voice.getState().enabled, false);
  const plays = audio.plays.length; e.voice.speak('lesson-predict'); await flush();
  assert.equal(audio.plays.length, plays, 'blocked autoplay is not retried without a new gesture');
  audio.nextPlay = null; e.voice.enable('lesson-predict'); await flush();
  assert.equal(e.voice.getState().status, 'playing');
});

test('manifest failure can retry using the same unlocked element', async () => {
  const e = environment({ fetchResponse: (_, attempt) => attempt === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ ok: true, json: async () => manifest }) });
  await flush(); assert.equal(e.voice.getState().status, 'error');
  e.voice.enable('lesson-body'); await flush();
  assert.equal(e.requests.length, 2); assert.equal(e.media.length, 1);
  assert.equal(e.voice.getState().status, 'playing');
  assert.equal(e.media[0].plays.filter(url => url.includes('.mp3')).length, 1);
});

test('stop while metadata is loading invalidates the pending narration', async () => {
  const pending = deferred();
  const e = environment({ fetchResponse: () => pending.promise });
  e.voice.enable('lesson-body'); e.voice.stop();
  pending.resolve({ ok: true, json: async () => manifest }); await flush();
  assert.equal(e.media[0].plays.filter(url => url.includes('.mp3')).length, 0, 'a stopped instruction must not resume after fetch resolves');
});

test('hiding during metadata loading never starts audio later', async () => {
  const pending = deferred();
  const e = environment({ fetchResponse: () => pending.promise });
  e.voice.enable('lesson-body');
  e.document.hidden = true; e.emit('visibilitychange');
  pending.resolve({ ok: true, json: async () => manifest }); await flush();
  assert.equal(e.media[0].plays.filter(url => url.includes('.mp3')).length, 0, 'metadata completion cannot start speech in the background');
  e.document.hidden = false; e.emit('visibilitychange'); await flush();
  assert.equal(e.media[0].plays.filter(url => url.includes('.mp3')).length, 0, 'returning to the page does not resume the old instruction');
});

test('hidden pages reject queued/new narration and stale play completion', async () => {
  const e = environment(); await flush(); const audio = e.media[0], pending = deferred();
  audio.nextPlay = () => pending.promise;
  e.voice.enable('lesson-body'); e.document.hidden = true; e.emit('visibilitychange');
  pending.resolve(); await flush();
  assert.equal(e.voice.isSpeaking(), false); assert.equal(audio.paused, true);
  const plays = audio.plays.length; audio.nextPlay = null;
  e.voice.speak('lesson-compare'); e.voice.schedule('night'); e.tick(1000); await flush();
  assert.equal(audio.plays.length, plays, 'new narration must not play while hidden');
  e.document.hidden = false; e.emit('visibilitychange'); await flush();
  assert.equal(audio.plays.length, plays, 'visibility alone must not resume audio');
  e.voice.enable('lesson-predict'); await flush();
  assert.equal(e.voice.isSpeaking(), true, 'an explicit action may restart narration after return');
  e.emit('pagehide'); assert.equal(audio.paused, true); assert.equal(e.voice.isSpeaking(), false);
});

test('every lesson branch emits a valid corpus ID, with no duplicate semantic updates', async () => {
  const e = lessonEnvironment();
  for (const predicted of ['day', 'night']) {
    e.lesson.start(); assert.equal(e.lesson.currentNarration(), 'lesson-body');
    e.action(predicted === 'day' ? 'body-done' : 'body-imagine'); e.action('next');
    e.answer(predicted); const predictionCalls = e.calls.length; e.answer(predicted);
    assert.equal(e.calls.length, predictionCalls, 'reselecting a prediction does not interrupt its narration');
    e.action('next'); e.action('turn');
    e.lesson.update({ elevation: -1, settled: true }); const observedCalls = e.calls.length;
    e.lesson.update({ elevation: -1, settled: true }); assert.equal(e.calls.length, observedCalls);
    e.action('next'); e.answer('sun-off'); e.answer('away'); e.answer('earth'); e.action('next');
    e.answer(predicted === 'day' ? 'night' : 'day'); e.action('view-home'); e.action('view-other'); e.action('finish');
    assert.equal(e.lesson.currentNarration(), null);
  }
  const general = new Set(['intro', 'day', 'night', 'sunrise', 'sunset', 'full-turn', 'challenge']);
  assert.deepEqual([...new Set(e.calls)].sort(), [...corpusIDs].filter(id => !general.has(id)).sort(), 'all guided clips are exercised by real lesson events');
});

(async () => {
  let failures = 0;
  for (const { name, run } of tests) {
    try { await run(); console.log(`PASS day/night voice: ${name}`); }
    catch (error) { failures++; console.error(`FAIL day/night voice: ${name}\n${error.stack}`); }
  }
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
