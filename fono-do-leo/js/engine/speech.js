/* Spoken instructions (speechSynthesis, pt-BR) and optional speech recognition. */

export const speechHooks = { onSpeaking: (_on) => {} };

let voice = null;
let baseRate = 1;

function pickVoice() {
  // Same voice and speed the family chose in the Trio do Saber games (numberblocks-1-100/game-voice.js)
  const shared = window.BlockVoice;
  if (shared?.supported) {
    const list = shared.voices();
    const s = shared.getSettings();
    voice = list.find((v) => v.voiceURI === s.voiceURI) ?? list[0] ?? null;
    baseRate = Math.min(1.1, Math.max(0.75, s.rate / 0.9));
    if (voice) return;
  }
  const vs = speechSynthesis.getVoices();
  const br = vs.filter((v) => /pt[-_]BR/i.test(v.lang));
  voice =
    br.find((v) => /luciana/i.test(v.name)) ??
    br.find((v) => /google/i.test(v.name)) ??
    br.find((v) => /female|feminina|francisca|vit[oó]ria/i.test(v.name)) ??
    br[0] ??
    vs.find((v) => /^pt/i.test(v.lang)) ??
    null;
}

let speakingCount = 0;

export const tts = {
  enabled: true,

  init() {
    if (!('speechSynthesis' in window)) return;
    pickVoice();
    speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
    window.addEventListener('blockvoiceschanged', pickVoice);
  },

  /** Must run inside a tap handler on iOS. */
  unlock() {
    if (!('speechSynthesis' in window)) return;
    pickVoice();
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  },

  say(text, opts = {}) {
    if (!this.enabled || !('speechSynthesis' in window) || !text.trim()) return Promise.resolve();
    if (!opts.queue) speechSynthesis.cancel();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR';
      if (voice) u.voice = voice;
      u.rate = (opts.rate ?? 1) * baseRate;
      u.pitch = opts.pitch ?? 1.1;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        speakingCount = Math.max(0, speakingCount - 1);
        if (!speakingCount) speechHooks.onSpeaking(false);
        resolve();
      };
      u.onend = finish;
      u.onerror = finish;
      speakingCount++;
      speechHooks.onSpeaking(true);
      speechSynthesis.speak(u);
      setTimeout(finish, 1500 + text.length * 110);
    });
  },

  stop() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    speakingCount = 0;
    speechHooks.onSpeaking(false);
  },
};

function SRClass() {
  const w = window;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const hasRecognition = () => !!SRClass();

/** Listen for one phrase; resolves with all alternatives joined by " | ", or null. */
export function listenOnce(timeoutMs = 7000, onPartial) {
  const C = SRClass();
  if (!C) return { result: Promise.resolve(null), cancel() {} };
  const r = new C();
  r.lang = 'pt-BR';
  r.interimResults = !!onPartial;
  r.continuous = false;
  r.maxAlternatives = 4;
  let finish = () => {};
  const result = new Promise((resolve) => {
    let done = false;
    let partial = '';
    finish = (v) => {
      if (done) return;
      done = true;
      try { r.abort(); } catch { /* already stopped */ }
      resolve(v);
    };
    r.onresult = (e) => {
      const alts = [];
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final = true;
        for (let j = 0; j < res.length; j++) alts.push(res[j].transcript);
      }
      partial = alts[0] ?? partial;
      onPartial?.(partial);
      if (final) finish(alts.join(' | '));
    };
    r.onerror = () => finish(partial || null);
    r.onend = () => finish(partial || null);
    setTimeout(() => finish(partial || null), timeoutMs);
    try { r.start(); } catch { finish(null); }
  });
  return { result, cancel: () => finish(null) };
}
