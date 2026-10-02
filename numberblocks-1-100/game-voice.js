/* Narração local do aparelho: português brasileiro, clara e sem sobreposição. */
(() => {
  'use strict';
  const synth = window.speechSynthesis;
  const supported = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
  const storageKey = 'triodosaber.blockvoice.v1';
  const settings = { rate: 0.9, voiceURI: '' };
  let available = [], voiceSignature = '', current = null, revision = 0;

  function applySettings(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.rate === 'number' && Number.isFinite(value.rate)) {
      settings.rate = Math.min(1.1, Math.max(0.75, value.rate));
    }
    if (typeof value.voiceURI === 'string') settings.voiceURI = value.voiceURI.slice(0, 500);
  }
  try { applySettings(JSON.parse(localStorage.getItem(storageKey))); } catch (_) {}

  const language = voice => String(voice.lang || '').replace(/_/g, '-').toLowerCase();
  function quality(voice) {
    const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    let score = language(voice) === 'pt-br' ? 1000 : 0;
    // Quality labels are hints; the user can always choose a different voice.
    if (/premium|superior/.test(name)) score += 100;
    if (/enhanced|aprimorada|melhorada/.test(name)) score += 70;
    if (/natural|neural/.test(name)) score += 60;
    if (/google/.test(name)) score += 30;
    if (/luciana|francisca|thalita|antonio/.test(name)) score += 15;
    if (/eddy|grandma|grandpa|rocko|sandy|shelley/.test(name)) score -= 15;
    if (/compact/.test(name)) score -= 20;
    if (voice.localService) score += 5;
    if (voice.default) score += 2;
    return score;
  }
  function refreshVoices() {
    if (!supported) return [];
    try {
      available = synth.getVoices()
        .filter(v => /^pt(?:-|$)/.test(language(v)))
        .sort((a, b) => quality(b) - quality(a) || a.name.localeCompare(b.name, 'pt-BR'));
      const signature = available.map(v => `${v.voiceURI}:${v.name}:${v.lang}`).join('|');
      if (signature !== voiceSignature) {
        voiceSignature = signature;
        window.dispatchEvent(new Event('blockvoiceschanged'));
      }
    } catch (_) {}
    return available.slice();
  }
  function stop() {
    revision++;
    if (current) current.onend = current.onerror = null;
    current = null;
    if (supported) { try { synth.cancel(); } catch (_) {} }
  }
  function unlock() {
    if (!supported) return false;
    refreshVoices();
    try { if (synth.paused) synth.resume(); } catch (_) {}
    return true;
  }
  function speak(text) {
    if (!supported || typeof text !== 'string' || !text.trim() || document.hidden) return false;
    stop();
    unlock();
    const token = revision;
    const utterance = new SpeechSynthesisUtterance(text.trim());
    const voice = available.find(v => v.voiceURI === settings.voiceURI) || available[0];
    if (voice) utterance.voice = voice;
    utterance.lang = voice ? voice.lang : 'pt-BR';
    utterance.rate = settings.rate;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = utterance.onerror = () => {
      if (token === revision) current = null;
    };
    current = utterance;
    // Keep this synchronous so a tap's browser audio permission is preserved.
    try { synth.speak(utterance); return true; }
    catch (_) { current = null; return false; }
  }
  function configure(value) {
    applySettings(value);
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch (_) {}
    return { ...settings };
  }

  window.BlockVoice = Object.freeze({
    speak, stop, configure, unlock, init: unlock,
    voices: refreshVoices,
    getSettings: () => ({ ...settings }),
    supported
  });
  if (supported) {
    synth.addEventListener('voiceschanged', refreshVoices);
    refreshVoices();
    window.addEventListener('pageshow', refreshVoices);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else refreshVoices();
    });
    window.addEventListener('pagehide', stop);
    // Some engines expose their installed voices only after the first gesture.
    document.addEventListener('pointerdown', unlock, { passive: true, once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }
})();
