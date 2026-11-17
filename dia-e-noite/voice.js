/* Pre-recorded ElevenLabs guidance. One reusable media element supports iOS. */
(() => {
  'use strict';
  const scriptURL = new URL(document.currentScript.src);
  const version = scriptURL.searchParams.get('v');
  const silence = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

  function create(onChange = () => {}) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
    let manifest = null, loading = null, revision = 0, timer = null;
    let enabled = false, requested = 'lesson-body', playingID = null;
    let status = 'loading', error = '';
    const state = () => ({ status, error, enabled, available: manifest?.available === true, clip: requested });
    function notify(next, message = '') { status = next; error = message; onChange(state()); }
    function cancelTimer() { clearTimeout(timer); timer = null; }
    function stop() {
      revision++; cancelTimer(); audio.onended = audio.onerror = null;
      audio.pause(); playingID = null;
      notify(manifest ? (manifest.available ? 'ready' : 'unavailable') : 'loading');
    }
    function load() {
      if (manifest) return Promise.resolve(manifest);
      if (!loading) {
        const url = new URL('audio/manifest.json', scriptURL);
        if (version) url.searchParams.set('v', version);
        loading = fetch(url).then(response => {
          if (!response.ok) throw new Error('manifest');
          return response.json();
        }).then(value => {
          if (value.available !== false && (value.provider !== 'ElevenLabs' || !value.clips || !Object.keys(value.clips).length)) throw new Error('manifest');
          for (const clip of Object.values(value.clips || {})) if (!/^[a-z0-9_-]+\.mp3$/i.test(clip.file || '')) throw new Error('clip');
          manifest = { ...value, available: value.available !== false };
          notify(manifest.available ? 'ready' : 'unavailable');
          return manifest;
        }).catch(() => {
          loading = null;
          notify('error', 'Toque em Ouvir para tentar carregar a voz de novo.');
          return null;
        });
      }
      return loading;
    }
    function play(id, force = false) {
      requested = id;
      cancelTimer();
      if (!enabled || document.hidden) return;
      if (!force && playingID === id && (status === 'playing' || status === 'loading')) return;
      const clip = manifest?.clips?.[id];
      if (!clip || !manifest.available) return;
      stop();
      const token = revision;
      playingID = id;
      const url = new URL(`audio/${clip.file}`, scriptURL);
      if (clip.sha256) url.searchParams.set('v', clip.sha256);
      audio.src = url.href;
      audio.playbackRate = .96;
      audio.onended = () => { if (token === revision) { playingID = null; notify('ready'); } };
      function fail(blocked = false) {
        if (token !== revision) return;
        audio.pause(); playingID = null;
        if (blocked) enabled = false;
        notify('error', blocked ? 'Toque no botão de voz para ouvir.' : 'Não deu para ouvir. Toque em Ouvir para tentar de novo.');
      }
      audio.onerror = () => fail();
      notify('loading');
      try {
        Promise.resolve(audio.play()).then(() => {
          if (token === revision) notify('playing');
        }).catch(reason => fail(reason?.name === 'NotAllowedError'));
      } catch (_) { fail(true); }
    }
    function speak(id, { force = false } = {}) {
      requested = id;
      if (!enabled || document.hidden) return;
      if (manifest) play(id, force);
      else { const token = revision; load().then(() => { if (enabled && token === revision && requested === id && !document.hidden) play(id, force); }); }
    }
    function enable(id = requested) {
      if (document.hidden) return;
      enabled = true;
      requested = id || requested;
      if (manifest) play(requested, true);
      else {
        // Unlock synchronously while the child is tapping; reuse the same element.
        audio.src = silence;
        Promise.resolve(audio.play()).catch(() => {});
        const wanted = requested, token = revision;
        load().then(() => { if (enabled && token === revision && requested === wanted && !document.hidden) play(wanted, true); });
      }
    }
    function disable() { enabled = false; stop(); }
    function schedule(id) {
      cancelTimer(); requested = id;
      if (enabled && !document.hidden) timer = setTimeout(() => speak(id), 650);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    window.addEventListener('pagehide', stop);
    load();
    return { load, speak, schedule, enable, disable, stop, getState: state,
      isSpeaking: () => enabled && playingID !== null && (status === 'playing' || status === 'loading') };
  }
  window.DayNightVoice = { create };
})();
