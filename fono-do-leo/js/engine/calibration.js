import { median } from '../util.js';

/** Collects neutral-face frames (mouth closed, looking at the camera) and builds a Baseline. */
export class Calibrator {
  frames = [];
  need = 36;

  /** Returns why a frame was rejected, or null when it was used. */
  push(f) {
    if (!f.present || !f.m) return 'none';
    if (f.quality === 'far') return 'far';
    if (f.quality === 'turned') return 'turned';
    if (f.m.openIn > 0.06 || (f.bs.jawOpen ?? 0) > 0.25) return 'open';
    this.frames.push(f);
    return null;
  }

  get progress() { return Math.min(1, this.frames.length / this.need); }
  done() { return this.frames.length >= this.need; }

  result() {
    const fr = this.frames;
    const med = (fn) => median(fr.map(fn));
    const names = new Set();
    fr.forEach((f) => Object.keys(f.bs).forEach((k) => names.add(k)));
    const bs = {};
    names.forEach((k) => { bs[k] = med((f) => f.bs[k] ?? 0); });
    // tongue false-positive floor: mean + 2 std of what the detector sees at rest
    const tzOf = (fn) => {
      const v = fr.filter((f) => f.tongue).map(fn);
      if (!v.length) return 0;
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
      return mean + 2 * sd;
    };
    return {
      mouthW: med((f) => f.m.mouthW),
      openIn: med((f) => f.m.openIn),
      upperLip: med((f) => f.m.upperLip),
      lowerLip: med((f) => f.m.lowerLip),
      cheekW: med((f) => f.m.cheekW),
      cheekAsym: med((f) => f.m.cheekAsym),
      bs,
      tz: {
        outUp: tzOf((f) => f.tongue.outUp),
        outDown: tzOf((f) => f.tongue.outDown),
        outLeft: tzOf((f) => f.tongue.outLeft),
        outRight: tzOf((f) => f.tongue.outRight),
        insideRed: tzOf((f) => f.tongue.insideRed),
      },
      at: Date.now(),
    };
  }
}
