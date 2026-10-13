import { b64ToF32, f32ToB64 } from '../util.js';

/*
 * Personalised tongue classifier ("Ensinar o Dino").
 * The parent records a few seconds of each tongue position with the child.
 * Each frame becomes a feature vector (pooled colour map of the mouth window +
 * a few geometric numbers); at run time we take a distance-weighted vote of
 * the k nearest recorded frames. It adapts to this child's face, skin tone
 * and the way he actually does each movement.
 */

export const TCLASSES = ['rest', 'aberta', 'fora', 'esq', 'dir', 'cima', 'baixo'];

export const TCLASS_LABEL = {
  rest: 'Boca fechada',
  aberta: 'Boca aberta, língua dentro',
  fora: 'Língua para fora',
  esq: 'Língua no canto ⬅',
  dir: 'Língua no canto ➡',
  cima: 'Língua para cima',
  baixo: 'Língua para baixo',
};

const KEY = 'leo-fono:knn:v1';
const K = 7;

export function featureVector(f) {
  const t = f.tongue, m = f.m;
  if (!t || !m) return null;
  const extra = [
    m.openIn * 4, (f.bs.jawOpen ?? 0) * 2, t.insideRed * 2, t.insideDark,
    t.outUp * 40, t.outDown * 40, t.outLeft * 40, t.outRight * 40, t.cu * 4, t.cv * 4,
  ];
  const v = new Float32Array(t.map.length + extra.length);
  v.set(t.map, 0);
  v.set(extra, t.map.length);
  return v;
}

export class TongueKnn {
  samples = [];
  mean = null;
  std = null;
  zs = [];

  ready() { return this.zs.length > 0 && this.classesTrained().length >= 3; }

  classesTrained() {
    const set = new Set(this.samples.map((s) => s.c));
    return TCLASSES.filter((c) => set.has(c));
  }

  count(c) { return this.samples.filter((s) => s.c === c).length; }

  clearClass(c) { this.samples = this.samples.filter((s) => s.c !== c); }

  add(c, v) { this.samples.push({ c, v }); }

  finalize() {
    if (!this.samples.length) { this.zs = []; return; }
    const dim = this.samples[0].v.length;
    const mean = new Float32Array(dim), std = new Float32Array(dim);
    for (const s of this.samples) for (let i = 0; i < dim; i++) mean[i] += s.v[i];
    for (let i = 0; i < dim; i++) mean[i] /= this.samples.length;
    for (const s of this.samples) for (let i = 0; i < dim; i++) std[i] += (s.v[i] - mean[i]) ** 2;
    for (let i = 0; i < dim; i++) std[i] = Math.max(0.05, Math.sqrt(std[i] / this.samples.length));
    this.mean = mean;
    this.std = std;
    this.zs = this.samples.map((s) => this.z(s.v));
  }

  z(v) {
    const out = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = (v[i] - this.mean[i]) / this.std[i];
    return out;
  }

  predict(f) {
    const res = Object.fromEntries(TCLASSES.map((c) => [c, 0]));
    const v = featureVector(f);
    if (!v || !this.mean) { res.rest = 1; return res; }
    const q = this.z(v);
    const best = [];
    for (let s = 0; s < this.zs.length; s++) {
      const z = this.zs[s];
      let d = 0;
      for (let i = 0; i < q.length; i++) { const e = q[i] - z[i]; d += e * e; }
      if (best.length < K || d < best[best.length - 1].d) {
        best.push({ d, c: this.samples[s].c });
        best.sort((a, b) => a.d - b.d);
        if (best.length > K) best.pop();
      }
    }
    let total = 0;
    for (const b of best) { const w = 1 / (Math.sqrt(b.d) + 1e-3); res[b.c] += w; total += w; }
    for (const c of TCLASSES) res[c] /= total || 1;
    return res;
  }

  save() {
    try {
      const data = this.samples.map((s) => ({ c: s.c, v: f32ToB64(s.v) }));
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.samples = data.map((d) => ({ c: d.c, v: b64ToF32(d.v) }));
      this.finalize();
    } catch {
      this.samples = [];
    }
  }

  clear() {
    this.samples = [];
    this.zs = [];
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }
}
