import { EXERCISES, STICKERS } from './data/exercises.js';
import { b64ToF32, f32ToB64, todayKey } from './util.js';

const KEYS = {
  settings: 'leo-fono:settings:v1',
  progress: 'leo-fono:progress:v1',
  baseline: 'leo-fono:baseline:v1',
  rest: 'leo-fono:rest:v1',
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the app keeps working for this session */
  }
}

export function defaultSettings() {
  return {
    routine: EXERCISES.filter((e) => e.routine).map((e) => ({ id: e.id, on: e.defaultOn, reps: e.reps })),
    sensLabios: 1,
    sensLingua: 1,
    sensSom: 1,
    voice: true,
    sfx: true,
    debug: false,
    speechRec: false,
    wordsPerAnimal: 8,
  };
}

function mergeSettings(s) {
  const d = defaultSettings();
  const out = { ...d, ...s };
  const known = new Map((s.routine ?? []).map((r) => [r.id, r]));
  // keep the parent's order and choices, append exercises added in newer versions
  const ordered = [];
  for (const r of s.routine ?? []) if (d.routine.some((x) => x.id === r.id)) ordered.push(r);
  for (const r of d.routine) if (!known.has(r.id)) ordered.push(r);
  out.routine = ordered;
  return out;
}

export const store = {
  settings: mergeSettings(load(KEYS.settings, {})),
  progress: load(KEYS.progress, { days: {}, stickers: [], fullDays: [] }),
  baseline: load(KEYS.baseline, null),

  saveSettings() { save(KEYS.settings, this.settings); },
  saveProgress() { save(KEYS.progress, this.progress); },
  saveBaseline(b) { this.baseline = b; save(KEYS.baseline, b); },

  saveRest(r) { save(KEYS.rest, { L: f32ToB64(r.L), A: f32ToB64(r.A), B: f32ToB64(r.B) }); },
  loadRest() {
    const r = load(KEYS.rest, null);
    if (!r) return null;
    try { return { L: b64ToF32(r.L), A: b64ToF32(r.A), B: b64ToF32(r.B) }; } catch { return null; }
  },

  today() {
    const k = todayKey();
    return (this.progress.days[k] ??= {});
  },

  routineIds() {
    const ids = this.settings.routine.filter((r) => r.on).map((r) => r.id);
    // the yawn always closes the session
    const y = ids.indexOf('bocejo');
    if (y >= 0) { ids.splice(y, 1); ids.push('bocejo'); }
    return ids;
  },

  repsFor(id) {
    return this.settings.routine.find((r) => r.id === id)?.reps ?? EXERCISES.find((e) => e.id === id)?.reps ?? 10;
  },

  log(id, entry) {
    const day = this.today();
    const prev = day[id];
    day[id] = prev
      ? {
          reps: prev.reps + entry.reps,
          auto: prev.auto + entry.auto,
          manual: prev.manual + entry.manual,
          ms: prev.ms + entry.ms,
          done: prev.done || entry.done,
          at: Date.now(),
          checkOk: (prev.checkOk ?? 0) + (entry.checkOk ?? 0),
          checkTotal: (prev.checkTotal ?? 0) + (entry.checkTotal ?? 0),
        }
      : { ...entry, at: Date.now() };
    const k = todayKey();
    const ids = this.routineIds();
    if (ids.length && ids.every((i) => day[i]?.done) && !this.progress.fullDays.includes(k)) this.progress.fullDays.push(k);
    this.saveProgress();
  },

  award() {
    const have = new Set(this.progress.stickers.map((s) => s.e));
    const fresh = STICKERS.filter((e) => !have.has(e));
    const pool = fresh.length ? fresh : STICKERS;
    const e = pool[Math.floor(Math.random() * pool.length)];
    this.progress.stickers.push({ e, at: Date.now() });
    this.saveProgress();
    return e;
  },

  resetProgress() {
    this.progress = { days: {}, stickers: [], fullDays: [] };
    this.saveProgress();
  },
};
