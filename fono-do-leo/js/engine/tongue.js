import { median } from '../util.js';

/*
 * Tongue analysis.
 *
 * MediaPipe's face mesh does not track the tongue, so we look at pixels instead.
 * Every frame we resample a face-aligned window around the mouth (the eye line
 * gives rotation and scale), convert it to CIELAB and classify each pixel as
 * skin / dark (mouth cavity, nostrils) / teeth / "red" (tongue or lip mucosa).
 * The lip outline from the mesh tells us where red is expected: red pixels
 * inside the mouth opening or outside the lips are tongue evidence.
 * Skin and lip colours are re-estimated every frame, so changes in lighting
 * or skin tone shift the thresholds with them.
 */

export const OUTER_LIPS = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
export const INNER_LIPS = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

/** Grid resolution: pixels per inter-ocular distance. */
export const PX = 44;
export const U0 = -0.72, U1 = 0.72, V0 = -0.5, V1 = 0.72;
export const GW = Math.round((U1 - U0) * PX);
export const GH = Math.round((V1 - V0) * PX);
const NPIX = GW * GH;
/** Pooled cells used as features by the personalised classifier. */
export const CX = 9, CY = 8;

export const C_NONE = 0, C_SKIN = 1, C_DARK = 2, C_TEETH = 3, C_RED = 4;

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const fLab = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

function fillPoly(poly, out) {
  out.fill(0);
  let minY = Infinity, maxY = -Infinity;
  for (const p of poly) { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
  const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(GH - 1, Math.ceil(maxY));
  const xs = [];
  const n = poly.length;
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > yc) !== (b.y > yc)) xs.push(a.x + ((yc - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5));
      const xb = Math.min(GW - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) out[y * GW + x] = 1;
    }
  }
}

export class TongueAnalyzer {
  canvas;
  L = new Float32Array(NPIX);
  A = new Float32Array(NPIX);
  B = new Float32Array(NPIX);
  valid = new Uint8Array(NPIX);
  cls = new Uint8Array(NPIX);
  outerRaw = new Uint8Array(NPIX);
  outerExp = new Uint8Array(NPIX);
  inner = new Uint8Array(NPIX);
  ev = new Uint8Array(NPIX);
  chg = new Uint8Array(NPIX);
  color = null;
  /** average appearance of the resting face (from the magic-mirror calibration) */
  rest = null;
  restSum = null;
  restN = null;
  /** Where between skin and lip redness the "tongue" threshold sits (lower = more sensitive). */
  redFrac = 0.5;
  ctx;
  bufA = new Float32Array(NPIX);
  bufL = new Float32Array(NPIX);
  bufB = new Float32Array(NPIX);

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = GW;
    this.canvas.height = GH;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.ctx.imageSmoothingQuality = 'high';
  }

  analyze(src, m, pts) {
    const { U, V, C } = m;
    const k = PX / m.iod;
    const ox = -U0 * PX, oy = -V0 * PX;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, GW, GH);
    ctx.setTransform(U.x * k, V.x * k, U.y * k, V.y * k, -(U.x * C.x + U.y * C.y) * k + ox, -(V.x * C.x + V.y * C.y) * k + oy);
    try {
      ctx.drawImage(src.el, 0, 0, src.width, src.height);
    } catch {
      return null;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const data = ctx.getImageData(0, 0, GW, GH).data;

    const { L, A, B, valid } = this;
    for (let i = 0, j = 0; i < NPIX; i++, j += 4) {
      if (data[j + 3] < 250) { valid[i] = 0; continue; }
      valid[i] = 1;
      const r = LIN[data[j]], g = LIN[data[j + 1]], b = LIN[data[j + 2]];
      const fx = fLab((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
      const fy = fLab(0.2126 * r + 0.7152 * g + 0.0722 * b);
      const fz = fLab((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
      L[i] = 116 * fy - 16;
      A[i] = 500 * (fx - fy);
      B[i] = 200 * (fy - fz);
    }

    const toG = (p) => {
      const dx = p.x - C.x, dy = p.y - C.y;
      return { x: (dx * U.x + dy * U.y) * k + ox, y: (dx * V.x + dy * V.y) * k + oy };
    };
    const outer = OUTER_LIPS.map((i) => toG(pts[i]));
    const inner = INNER_LIPS.map((i) => toG(pts[i]));
    let gcx = 0, gcy = 0;
    for (const p of outer) { gcx += p.x; gcy += p.y; }
    gcx /= outer.length;
    gcy /= outer.length;
    const margin = 0.05 * PX;
    const outerE = outer.map((p) => {
      const dx = p.x - gcx, dy = p.y - gcy;
      const l = Math.hypot(dx, dy) || 1;
      return { x: p.x + (dx / l) * margin, y: p.y + (dy / l) * margin };
    });
    fillPoly(outer, this.outerRaw);
    fillPoly(outerE, this.outerExp);
    fillPoly(inner, this.inner);

    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    for (const p of outer) {
      const u = p.x / PX + U0, v = p.y / PX + V0;
      if (u < uMin) uMin = u; if (u > uMax) uMax = u;
      if (v < vMin) vMin = v; if (v > vMax) vMax = v;
    }
    const uc = (uMin + uMax) / 2, vc = (vMin + vMax) / 2, halfW = (uMax - uMin) / 2;

    const gL = this.updateColor(uc, halfW, vMax);
    const cm = this.color;
    const contrast = Math.max(cm.lipA - cm.skinA, 4);
    const thrA = cm.skinA + Math.max(2.5 * cm.skinAStd, 3, contrast * this.redFrac);
    const darkL = cm.skinL * 0.5, teethL = cm.skinL * 0.8;
    const rest = this.rest;
    // colour distance from the resting face that counts as "something covers the skin"
    const chgT = 11 * (this.redFrac / 0.5);
    const chgT2 = chgT * chgT;

    // pass 1: classify every pixel, flag what changed since the resting face
    const { cls, ev, chg } = this;
    const map = new Float32Array(CX * CY * 2);
    const mapN = new Float32Array(CX * CY);
    for (let gy = 0; gy < GH; gy++) {
      const cy = Math.min(CY - 1, Math.floor((gy / GH) * CY));
      for (let gx = 0; gx < GW; gx++) {
        const i = gy * GW + gx;
        ev[i] = 0;
        chg[i] = 0;
        if (!valid[i]) { cls[i] = C_NONE; continue; }
        const l = L[i], a = A[i];
        let c;
        if (l < darkL) c = C_DARK;
        else if (this.outerExp[i] && l > teethL && a < cm.skinA - 1) c = C_TEETH;
        else if (a >= thrA) c = C_RED;
        else c = C_SKIN;
        cls[i] = c;
        if (rest && c !== C_DARK && !this.outerExp[i]) {
          const rl = rest.L[i];
          if (rl === rl) {
            const dl = (l - rl - gL) * 0.35, da = a - rest.A[i], db = B[i] - rest.B[i];
            if (dl * dl + da * da + db * db > chgT2) chg[i] = 1;
          }
        }
        const cell = cy * CX + Math.min(CX - 1, Math.floor((gx / GW) * CX));
        map[cell * 2] += Math.max(-1, Math.min(2, (a - cm.skinA) / contrast));
        map[cell * 2 + 1] += c === C_DARK ? 1 : 0;
        mapN[cell]++;
      }
    }

    // pass 2: tongue evidence inside the mouth opening and in the zones a tongue can reach
    let innerN = 0, innerRed = 0, innerDark = 0;
    let up = 0, down = 0, left = 0, right = 0, evN = 0, su = 0, sv = 0;
    for (let gy = 1; gy < GH - 1; gy++) {
      const v = (gy + 0.5) / PX + V0;
      for (let gx = 1; gx < GW - 1; gx++) {
        const i = gy * GW + gx;
        if (!valid[i]) continue;
        const c = cls[i];
        const du = (gx + 0.5) / PX + U0 - uc;
        if (this.inner[i]) {
          innerN++;
          if (c === C_RED) { innerRed++; ev[i] = 1; }
          else if (c === C_DARK) innerDark++;
        } else if (!this.outerExp[i] && c !== C_DARK) {
          // a changed pixel only counts when its neighbours changed too (alignment jitter is speckled)
          const changed = chg[i] && chg[i - 1] + chg[i + 1] + chg[i - GW] + chg[i + GW] >= 2;
          if (c !== C_RED && !changed) continue;
          // zones a tongue can reach; folds beside the nose and chin shadows are ignored
          const adu = Math.abs(du);
          if (adu <= halfW * 0.85) {
            if (v < vMin && v >= vMin - 0.24) up++;
            else if (v > vMax && v <= vMax + 0.45) down++;
            else continue;
          } else if (adu <= halfW + 0.32 && v >= vMin - 0.06 && v <= vMax + 0.12) {
            if (du > 0) left++; else right++;
          } else continue;
          ev[i] = 1;
        }
        if (ev[i]) { evN++; su += du; sv += v - vc; }
      }
    }
    for (let c = 0; c < CX * CY; c++) {
      const n = mapN[c] || 1;
      map[c * 2] /= n;
      map[c * 2 + 1] /= n;
    }
    const area = 1 / (PX * PX);
    return {
      innerArea: innerN * area,
      insideRed: innerN > 6 ? innerRed / innerN : 0,
      insideDark: innerN > 6 ? innerDark / innerN : 0,
      outUp: up * area,
      outDown: down * area,
      outLeft: left * area,
      outRight: right * area,
      evArea: evN * area,
      cu: evN ? su / evN : 0,
      cv: evN ? sv / evN : 0,
      lipHalfW: halfW,
      contrast: cm.lipA - cm.skinA,
      map,
    };
  }

  beginRest() {
    this.restSum = new Float64Array(NPIX * 3);
    this.restN = new Uint16Array(NPIX);
  }

  /** Add the frame analysed last (call right after a neutral frame was accepted). */
  addRestFrame() {
    const s = this.restSum, n = this.restN;
    if (!s || !n) return;
    for (let i = 0; i < NPIX; i++) {
      if (!this.valid[i]) continue;
      s[i * 3] += this.L[i];
      s[i * 3 + 1] += this.A[i];
      s[i * 3 + 2] += this.B[i];
      n[i]++;
    }
  }

  endRest() {
    const s = this.restSum, n = this.restN;
    this.restSum = null;
    this.restN = null;
    if (!s || !n) return false;
    const L = new Float32Array(NPIX), A = new Float32Array(NPIX), B = new Float32Array(NPIX);
    let filled = 0;
    for (let i = 0; i < NPIX; i++) {
      if (n[i] < 3) { L[i] = A[i] = B[i] = NaN; continue; }
      L[i] = s[i * 3] / n[i];
      A[i] = s[i * 3 + 1] / n[i];
      B[i] = s[i * 3 + 2] / n[i];
      filled++;
    }
    if (filled < NPIX * 0.5) return false;
    this.rest = { L, A, B };
    return true;
  }

  /** Re-estimate skin and lip colour from this frame (median, so a moving tongue barely shifts it). */
  updateColor(uc, halfW, vMax) {
    let ns = 0, nl = 0, nd = 0;
    const dL = [];
    const rest = this.rest;
    const { L, A, B, valid, outerExp, outerRaw, inner, bufA, bufL, bufB } = this;
    const lipA = [], lipL = [], lipB = [];
    for (let gy = 0; gy < GH; gy++) {
      const v = (gy + 0.5) / PX + V0;
      for (let gx = (gy & 1); gx < GW; gx += 2) {
        const i = gy * GW + gx;
        if (!valid[i]) continue;
        if (outerRaw[i] && !inner[i]) {
          lipA.push(A[i]); lipL.push(L[i]); lipB.push(B[i]);
          nl++;
        } else if (!outerExp[i]) {
          const u = (gx + 0.5) / PX + U0;
          if (v < -0.3 || v > vMax + 0.35 || Math.abs(u - uc) > halfW + 0.35) continue;
          bufA[ns] = A[i]; bufL[ns] = L[i]; bufB[ns] = B[i];
          ns++;
          if (rest) { const rl = rest.L[i]; if (rl === rl) { dL.push(L[i] - rl); nd++; } }
        }
      }
    }
    const gL = nd > 30 ? median(dL) : 0;
    if (ns < 40) return gL;
    const skinA = median(bufA, ns);
    for (let i = 0; i < ns; i++) bufA[i] = Math.abs(bufA[i] - skinA);
    const est = {
      skinA,
      skinAStd: Math.max(1, median(bufA, ns) * 1.4826),
      skinL: median(bufL, ns),
      skinB: median(bufB, ns),
      lipA: this.color?.lipA ?? skinA + 10,
      lipL: this.color?.lipL ?? 50,
      lipB: this.color?.lipB ?? 10,
    };
    if (nl >= 12) {
      const la = median(lipA);
      if (la - skinA > 3) {
        est.lipA = la;
        est.lipL = median(lipL);
        est.lipB = median(lipB);
      }
    }
    if (!this.color) { this.color = est; return gL; }
    const c = this.color;
    const t = 0.2;
    for (const key of Object.keys(est)) c[key] = c[key] + (est[key] - c[key]) * t;
    return gL;
  }
}
