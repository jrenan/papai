import { norm } from '../util.js';

export const POSES = [
  'bico', 'bicoAberto', 'sorriso', 'beijoVovo', 'bochechas',
  'bocaAberta', 'bocaFechada', 'bocejo',
  'linguaFora', 'linguaDentro', 'linguaEsq', 'linguaDir', 'linguaCima', 'linguaBaixo',
  'balaEsq', 'balaDir',
];

export const DEFAULT_BASELINE = {
  mouthW: 0.52, openIn: 0.01, upperLip: 0.09, lowerLip: 0.1, cheekW: 1.45, cheekAsym: 0,
  bs: {}, tz: { outUp: 0, outDown: 0, outLeft: 0, outRight: 0, insideRed: 0 }, at: 0,
};

/**
 * Every threshold lives here so they can be tuned against real recordings.
 * Each pair is [value where the score starts, value where it reaches 1].
 * Sensitivity divides the pair: 1.3 = 30% easier.
 */
export const TUNING = {
  jaw: [0.2, 0.45], open: [0.12, 0.25],
  yawnJaw: [0.45, 0.7], yawnOpen: [0.28, 0.42],
  smile: [0.2, 0.5], widen: [0.07, 0.16],
  pucker: [0.2, 0.5], narrow: [0.1, 0.22],
  funnel: [0.15, 0.4],
  roll: [0.15, 0.4], lipThin: [0.25, 0.5],
  puff: [0.06, 0.25], cheekGrow: [0.015, 0.045],
  bala: [0.02, 0.05],
  tongueOut: [0.01, 0.03], tongueInside: [0.5, 0.8],
  tongueSide: [0.006, 0.018], tongueUp: [0.006, 0.016], tongueDown: [0.008, 0.022],
  presence: [0.008, 0.025],
  cuSide: [0.1, 0.2], cvUp: [0.02, 0.07], cvDown: [0.06, 0.12],
} ;

const ON = 0.55, OFF = 0.4;

export class PoseState {
  score = Object.fromEntries(POSES.map((p) => [p, 0]));
  act = Object.fromEntries(POSES.map((p) => [p, false]));
  /** raw tongue numbers after baseline subtraction (shown in the detector screen) */
  dbg = {};
  usingKnn = false;

  is(p) { return this.act[p]; }

  /** The tongue direction currently shown, for the mirroring dino. */
  tongueDir() {
    const s = this.score;
    const cands = [
      [s.linguaEsq, 'left'], [s.linguaDir, 'right'], [s.linguaCima, 'up'], [s.linguaBaixo, 'down'], [s.linguaFora * 0.95, 'out'],
    ];
    cands.sort((a, b) => b[0] - a[0]);
    return cands[0][0] > 0.5 ? cands[0][1] : 'none';
  }

  reset() {
    for (const p of POSES) { this.score[p] = 0; this.act[p] = false; }
  }

  update(f, base, sens, knn) {
    if (!f.present || !f.m) {
      for (const p of POSES) { this.score[p] *= 0.7; this.act[p] = false; }
      return;
    }
    const b = base ?? DEFAULT_BASELINE;
    const m = f.m;
    const d = (k) => Math.max(0, (f.bs[k] ?? 0) - (b.bs[k] ?? 0) * 0.85);
    const sl = sens.labios, st = sens.lingua;
    const T = TUNING;
    const N = (x, r, s) => norm(x, r[0] / s, r[1] / s);

    const jaw = d('jawOpen');
    const open = m.openIn;
    const smileBs = (d('mouthSmileLeft') + d('mouthSmileRight')) / 2;
    const widen = m.mouthW / b.mouthW - 1;
    const pucker = d('mouthPucker');
    const funnel = d('mouthFunnel');
    const lipRatio = (m.upperLip + m.lowerLip) / Math.max(0.01, b.upperLip + b.lowerLip);
    const roll = (d('mouthRollUpper') + d('mouthRollLower')) / 2;
    const closedGate = 1 - norm(open, 0.05, 0.12);
    const s = { ...this.score };

    s.bocaAberta = Math.max(N(jaw, T.jaw, sl), N(open, T.open, sl));
    s.bocejo = Math.max(N(jaw, T.yawnJaw, sl), N(open, T.yawnOpen, sl));
    s.bocaFechada = 1 - norm(open, 0.025, 0.07);
    s.sorriso = Math.max(N(smileBs, T.smile, sl), N(widen, T.widen, sl)) * (1 - norm(pucker, 0.3, 0.6));
    s.bico = Math.max(N(pucker, T.pucker, sl), 0.85 * N(-widen, T.narrow, sl))
      * (1 - norm(jaw, 0.25, 0.45)) * (1 - norm(smileBs, 0.3, 0.5));
    s.bicoAberto = N(funnel, T.funnel, sl) * norm(open, 0.02, 0.06);
    s.beijoVovo = Math.max(N(roll, T.roll, sl), N(1 - lipRatio, T.lipThin, sl)) * closedGate;
    s.bochechas = Math.max(N(d('cheekPuff'), T.puff, sl), N(m.cheekW / b.cheekW - 1, T.cheekGrow, sl)) * closedGate;
    const asym = m.cheekAsym - b.cheekAsym;
    s.balaEsq = N(asym, T.bala, sl) * closedGate;
    s.balaDir = N(-asym, T.bala, sl) * closedGate;

    const tg = f.tongue;
    if (knn && knn.ready() && tg) {
      const p = knn.predict(f);
      this.usingKnn = true;
      const out = 1 - p.rest - p.aberta;
      s.linguaFora = out;
      s.linguaDentro = p.rest + p.aberta;
      s.linguaEsq = p.esq;
      s.linguaDir = p.dir;
      s.linguaCima = p.cima;
      s.linguaBaixo = p.baixo + p.fora * 0.4;
      this.dbg = { ...p };
    } else if (tg) {
      this.usingKnn = false;
      const tz = b.tz;
      const up = Math.max(0, tg.outUp - tz.outUp);
      const down = Math.max(0, tg.outDown - tz.outDown);
      const left = Math.max(0, tg.outLeft - tz.outLeft);
      const right = Math.max(0, tg.outRight - tz.outRight);
      const outArea = up + down + left + right;
      const ins = Math.max(0, tg.insideRed - tz.insideRed);
      const openG = norm(open, 0.03, 0.08);
      const present = Math.max(N(outArea, T.presence, st), N(ins, [0.35, 0.65], st) * openG);
      s.linguaFora = Math.max(N(outArea, T.tongueOut, st), N(ins, T.tongueInside, st) * openG);
      s.linguaDentro = 1 - Math.max(s.linguaFora, N(outArea, [0.006, 0.014], st));
      // each direction needs enough area AND most of the area: a tongue going down also grazes the sides
      const share = (x) => norm(x / (outArea + 1e-6), 0.3, 0.55);
      const insideOnly = outArea < T.presence[0] / st;
      s.linguaEsq = Math.max(N(left, T.tongueSide, st) * share(left), insideOnly ? present * N(tg.cu, T.cuSide, 1) : 0);
      s.linguaDir = Math.max(N(right, T.tongueSide, st) * share(right), insideOnly ? present * N(-tg.cu, T.cuSide, 1) : 0);
      s.linguaCima = Math.max(N(up, T.tongueUp, st) * share(up), insideOnly ? present * N(-tg.cv, T.cvUp, 1) : 0);
      s.linguaBaixo = Math.max(N(down, T.tongueDown, st) * share(down), insideOnly ? present * N(tg.cv, T.cvDown, 1) : 0);
      // a big grin folds the lip corners; a tongue is rare then, so soften the evidence
      const smileDamp = 1 - 0.35 * norm(smileBs, 0.7, 0.95);
      for (const k of ['linguaFora', 'linguaEsq', 'linguaDir', 'linguaCima', 'linguaBaixo']) s[k] *= smileDamp;
      s.linguaDentro = Math.min(s.linguaDentro, 1 - s.linguaFora);
      this.dbg = { up, down, left, right, ins, cu: tg.cu, cv: tg.cv, contrast: tg.contrast };
    } else {
      s.linguaFora = 0; s.linguaDentro = 1;
      s.linguaEsq = s.linguaDir = s.linguaCima = s.linguaBaixo = 0;
    }

    for (const p of POSES) {
      const v = this.score[p] * 0.45 + s[p] * 0.55;
      this.score[p] = v;
      this.act[p] = this.act[p] ? v >= OFF : v >= ON;
    }
  }
}
