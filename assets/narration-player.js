/* Jessica, pré-gravada: somente arquivos locais; nenhum serviço de voz no navegador. */
(() => {
  'use strict';
  const scriptURL = document.currentScript?.src || new URL('assets/narration-player.js', document.baseURI).href;
  const manifestURL = new URL('narration/manifest.json', scriptURL);
  const audioBase = new URL('narration/', scriptURL);
  const supported = typeof window.Audio === 'function';
  const normalize = text => String(text || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const compositionKey = text => normalize(text).toLocaleLowerCase('pt-BR').replace(/[.!?,:;]/g, ' ').replace(/\s+/g, ' ').trim();
  const exact = new Map(), beginnings = new Map();
  let audio = null, revision = 0, manifest = null, manifestPromise = null;
  let completion = Promise.resolve(true), completePlayback = null;
  let state = { status: 'loading', error: '', ready: false, supported };
  // A tiny local WAV unlocks this one media element inside the first user gesture.
  // It is not narration, and never substitutes a missing recording.
  const silence = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

  function notify(status, error = '') {
    state = { status, error, ready: !!manifest && supported, supported };
    window.dispatchEvent(new CustomEvent('trionarrationchange', { detail: { ...state } }));
  }
  function media() {
    if (!audio && supported) {
      audio = new Audio();
      audio.preload = 'none';
      audio.setAttribute('playsinline', '');
      audio.preservesPitch = true;
    }
    return audio;
  }
  function stop() {
    revision++;
    completePlayback?.(false);
    completePlayback = null;
    if (audio) {
      audio.onended = audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    notify(manifest ? 'ready' : state.status === 'error' ? 'error' : 'loading', state.status === 'error' ? state.error : '');
  }
  function unlock() {
    const element = media();
    if (!element || document.hidden || state.status === 'playing') return false;
    // Never replace a narration already loading in response to a previous tap.
    if (element.src && element.src !== silence) return true;
    const token = revision;
    element.src = silence;
    const attempt = element.play();
    if (attempt?.then) attempt.then(() => {
      if (token === revision && element.src === silence) element.pause();
    }).catch(() => {});
    return true;
  }
  function indexManifest(value) {
    if (!value || !Array.isArray(value.clips) || !value.clips.length) throw new Error('Manifesto de narração vazio.');
    for (const clip of [...value.clips].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
      if (!clip.text || !/^[a-zA-Z0-9_-]+\.mp3$/.test(clip.file || '')) throw new Error('Arquivo de narração inválido.');
      const normalized = normalize(clip.text), key = compositionKey(clip.text);
      if (!exact.has(normalized)) exact.set(normalized, clip);
      if (key) {
        const word = key.split(' ', 1)[0];
        if (!beginnings.has(word)) beginnings.set(word, []);
        beginnings.get(word).push({ key, clip });
      }
    }
    for (const clips of beginnings.values()) clips.sort((a, b) => b.key.length - a.key.length || String(a.clip.id).localeCompare(String(b.clip.id)));
    manifest = value;
    notify('ready');
    return value;
  }
  function loadManifest() {
    if (manifest) return Promise.resolve(manifest);
    if (!manifestPromise) {
      manifestPromise = Promise.resolve().then(() => {
        if (window.TRIO_NARRATION_MANIFEST) return window.TRIO_NARRATION_MANIFEST;
        // Normal pages preload manifest.js, which also supports file:// previews.
        // The JSON path is a fallback for integrators loading only this player.
        const version = new URL(scriptURL).searchParams.get('v');
        if (version) manifestURL.searchParams.set('v', version);
        return fetch(manifestURL).then(response => {
          if (!response.ok) throw new Error('Não foi possível carregar as narrações.');
          return response.json();
        });
      }).then(indexManifest).catch(() => {
        manifestPromise = null;
        notify('error', 'Narração indisponível. Toque em Ouvir para tentar de novo.');
        return null;
      });
    }
    return manifestPromise;
  }
  function resolve(text) {
    const normalized = normalize(text), direct = exact.get(normalized);
    if (direct) return [direct];
    const key = compositionKey(normalized);
    if (!key) return null;
    // Every word must be covered. Ties keep the longest leftmost matching clip.
    const memo = new Map([[key.length, []]]);
    function visit(start) {
      if (memo.has(start)) return memo.get(start);
      const end = key.indexOf(' ', start), word = key.slice(start, end < 0 ? key.length : end);
      let best = null;
      for (const entry of beginnings.get(word) || []) {
        if (!key.startsWith(entry.key, start)) continue;
        const next = start + entry.key.length;
        if (next < key.length && key[next] !== ' ') continue;
        const tail = visit(next === key.length ? next : next + 1);
        if (tail && (!best || tail.length + 1 < best.length)) best = [entry.clip, ...tail];
      }
      memo.set(start, best);
      return best;
    }
    return visit(0);
  }
  function playClips(clips, token, rate) {
    const element = media();
    let index = 0;
    function advance() {
      if (token !== revision || document.hidden) return;
      if (index >= clips.length) {
        element.onended = element.onerror = null;
        completePlayback?.(true);
        completePlayback = null;
        notify('ready');
        return;
      }
      const clip = clips[index++];
      const clipURL = new URL(clip.file, audioBase);
      const cacheVersion = clip.sha256 || manifest.configurationSHA256 || manifest.version;
      if (cacheVersion != null) clipURL.searchParams.set('v', String(cacheVersion));
      element.src = clipURL.href;
      element.playbackRate = rate;
      element.onended = advance;
      element.onerror = () => fail('Não foi possível ouvir. Toque em Ouvir para tentar de novo.');
      function fail(message) {
        if (token !== revision) return;
        revision++;
        element.onended = element.onerror = null;
        element.pause();
        completePlayback?.(false);
        completePlayback = null;
        notify('error', message);
      }
      try {
        const attempt = element.play();
        if (attempt?.then) attempt.then(() => {
          if (token === revision) notify('playing');
        }).catch(error => fail(error?.name === 'NotAllowedError'
          ? 'Toque em Ouvir para liberar o áudio.'
          : 'Não foi possível ouvir. Toque em Ouvir para tentar de novo.'));
      } catch (_) { fail('Toque em Ouvir para liberar o áudio.'); }
    }
    notify('loading');
    advance();
  }
  async function speak(text, options = {}) {
    if (!supported || document.hidden || !normalize(text)) return false;
    // Preserve the gesture before the first asynchronous operation.
    stop();
    unlock();
    const token = revision;
    completion = new Promise(resolve => { completePlayback = resolve; });
    const loaded = manifest || await loadManifest();
    if (!loaded || token !== revision || document.hidden) {
      if (token === revision) { completePlayback?.(false); completePlayback = null; }
      return false;
    }
    const clips = resolve(text);
    if (!clips) {
      completePlayback?.(false);
      completePlayback = null;
      notify('error', 'Esta narração não está disponível.');
      return false;
    }
    const rate = Number.isFinite(options.rate) ? Math.max(0.75, Math.min(1.1, options.rate)) : 1;
    playClips(clips, token, rate);
    return true;
  }
  function finished(timeout = 15000) {
    // Game-driven counting follows the real recording rather than a fixed timer.
    // A stalled connection cannot trap a child in an indefinitely busy scene.
    const currentCompletion = completion;
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), timeout);
      currentCompletion.then(result => { clearTimeout(timer); resolve(result); });
    });
  }
  window.TrioNarration = Object.freeze({
    speak, stop, unlock, finished, load: loadManifest, supported,
    getState: () => ({ ...state }),
    resolve: text => (resolve(text) || []).map(clip => clip.id),
  });
  if (window.TRIO_NARRATION_MANIFEST) {
    try { indexManifest(window.TRIO_NARRATION_MANIFEST); }
    catch (_) { notify('error', 'Narração indisponível.'); }
  } else loadManifest();
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
})();
