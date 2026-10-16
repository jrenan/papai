/* Narrações Jessica compartilhadas pelos dois jogos; preferências continuam locais. */
(() => {
  'use strict';
  const player = window.TrioNarration;
  const storageKey = 'triodosaber.blockvoice.v1';
  const settings = { rate: 0.9, voiceURI: 'jessica-eleven-v4' };
  let lastAnnouncedError = '';
  function applySettings(value) {
    if (typeof value?.rate === 'number' && Number.isFinite(value.rate)) settings.rate = Math.min(1.1, Math.max(0.75, value.rate));
  }
  try { applySettings(JSON.parse(localStorage.getItem(storageKey))); } catch (_) {}
  function configure(value) {
    applySettings(value);
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch (_) {}
    return { ...settings };
  }
  function updateStatus() {
    const state = player?.getState();
    const error = state?.status === 'error' ? state.error : '';
    if (error && error !== lastAnnouncedError) {
      // A failure may arrive while focus stays on a block rather than Ouvir.
      // Defer until the game's synchronous render has restored its instructions.
      Promise.resolve().then(() => {
        if (player?.getState().error !== error || document.hidden) return;
        const announcement = document.querySelector('#announcement');
        if (announcement) announcement.textContent = error;
      });
    }
    lastAnnouncedError = error;
    for (const button of document.querySelectorAll('[data-act="repeat"], [data-act="voice-test"]')) {
      const test = button.dataset.act === 'voice-test';
      button.title = error;
      button.setAttribute('aria-label', error || (test ? 'Ouvir a voz Jessica' : 'Ouvir de novo'));
      if (test) button.textContent = error ? 'Áudio indisponível · tentar' : 'Ouvir a voz';
      else {
        const label = button.querySelector('span:not([data-audio-warning])');
        if (label) label.textContent = error ? 'Áudio indisponível' : 'Ouvir';
        const icon = button.querySelector('svg');
        if (icon) icon.style.display = error ? 'none' : '';
        let warning = button.querySelector('[data-audio-warning]');
        if (error && !warning) {
          warning = document.createElement('span');
          warning.dataset.audioWarning = '';
          warning.setAttribute('aria-hidden', 'true');
          warning.style.display = 'inline';
          warning.textContent = '⚠';
          button.prepend(warning);
        } else if (!error) warning?.remove();
      }
      button.dataset.audioStatus = state?.status || 'unavailable';
    }
  }
  window.BlockVoice = Object.freeze({
    speak: text => player?.speak(text, { rate: settings.rate }) || false,
    stop: () => player?.stop(),
    finished: () => player?.finished() || Promise.resolve(false),
    configure, unlock: () => player?.unlock(), init: () => player?.unlock(),
    voices: () => [{ name: 'Jessica · português brasileiro', voiceURI: settings.voiceURI, lang: 'pt-BR' }],
    getSettings: () => ({ ...settings }),
    getState: () => player?.getState() || { supported: false, ready: false, status: 'unavailable' },
    refreshControls: updateStatus,
    supported: !!player?.supported,
  });
  window.addEventListener('trionarrationchange', updateStatus);
})();
