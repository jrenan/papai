import { clamp, lerp } from '../util.js';

/*
 * The blue dinosaur from the notebook's "Caretas com o dinossauro" cards,
 * drawn as an SVG rig. Its mouth, tongue, cheeks, eyes and head tilt are
 * parameters, so it can either copy Leo in real time (mirror) or demonstrate
 * the face he should make. Left/right are screen sides, as in a mirror.
 */

export const NEUTRAL = {
  jaw: 0, pucker: 0, funnel: 0, smile: 0.15, roll: 0, puffL: 0, puffR: 0,
  tongue: 'none', blinkL: 0, blinkR: 0, tilt: 0, blow: 0, trill: 0,
};

const NUM_KEYS = ['jaw', 'pucker', 'funnel', 'smile', 'roll', 'puffL', 'puffR', 'blinkL', 'blinkR', 'tilt', 'blow', 'trill'];

export function faceForPose(p) {
  switch (p) {
    case 'bico': return { pucker: 1, smile: 0 };
    case 'bicoAberto': return { funnel: 1, jaw: 0.25, smile: 0 };
    case 'sorriso': return { smile: 1, jaw: 0.12 };
    case 'beijoVovo': return { roll: 1, smile: 0 };
    case 'bochechas': return { puffL: 1, puffR: 1, smile: 0 };
    case 'bocaAberta': return { jaw: 0.75, smile: 0 };
    case 'bocejo': return { jaw: 1, blinkL: 1, blinkR: 1, smile: 0 };
    case 'bocaFechada': return { smile: 0.1 };
    case 'linguaFora': return { jaw: 0.4, tongue: 'out', smile: 0 };
    case 'linguaDentro': return { smile: 0.2 };
    case 'linguaEsq': return { jaw: 0.3, tongue: 'left', smile: 0 };
    case 'linguaDir': return { jaw: 0.3, tongue: 'right', smile: 0 };
    case 'linguaCima': return { jaw: 0.45, tongue: 'up', smile: 0 };
    case 'linguaBaixo': return { jaw: 0.45, tongue: 'down', smile: 0 };
    case 'balaEsq': return { puffL: 0.9, smile: 0 };
    case 'balaDir': return { puffR: 0.9, smile: 0 };
  }
}

/** What the mirroring dino shows for Leo's current frame. */
export function faceFromLeo(f, p) {
  const bs = f.bs;
  const tongue = p.tongueDir();
  const jaw = clamp((bs.jawOpen ?? 0) * 1.4);
  return {
    jaw: tongue !== 'none' ? Math.max(jaw, 0.3) : jaw,
    pucker: p.score.bico,
    funnel: clamp((bs.mouthFunnel ?? 0) * 1.3),
    smile: clamp(((bs.mouthSmileLeft ?? 0) + (bs.mouthSmileRight ?? 0)) * 0.75),
    roll: p.score.beijoVovo,
    puffL: Math.max(p.score.bochechas, p.score.balaEsq),
    puffR: Math.max(p.score.bochechas, p.score.balaDir),
    tongue,
    blinkL: bs.eyeBlinkLeft ?? 0,
    blinkR: bs.eyeBlinkRight ?? 0,
    tilt: f.m ? clamp((-f.m.roll * 180) / Math.PI, -18, 18) : 0,
    blow: 0,
    trill: 0,
  };
}

const MCX = 160, MCY = 198;

const SVG = `
<svg viewBox="0 0 320 300" class="dino" aria-hidden="true">
  <defs><clipPath id="CLIP"><path class="d-clip"/></clipPath></defs>
  <g class="d-body">
    <path class="d-skin" d="M222 282 C262 284 292 270 314 236 C318 262 306 294 262 306 L222 306 Z"/>
    <path class="d-spike" d="M268 280 L284 258 L290 280 Z"/>
    <path class="d-spike" d="M290 268 L306 246 L308 266 Z"/>
    <path class="d-skin" d="M62 304 C66 246 106 222 160 222 C214 222 254 246 258 304 Z"/>
    <path class="d-belly" d="M112 304 C114 266 134 250 160 250 C186 250 206 266 208 304 Z"/>
    <ellipse class="d-skin" cx="94" cy="270" rx="15" ry="22" transform="rotate(28 94 270)"/>
    <ellipse class="d-skin" cx="226" cy="270" rx="15" ry="22" transform="rotate(-28 226 270)"/>
  </g>
  <g class="d-head">
    <path class="d-spike" d="M124 60 L136 14 L152 54 Z"/>
    <path class="d-spike" d="M144 54 L160 0 L176 54 Z"/>
    <path class="d-spike" d="M168 54 L184 14 L196 60 Z"/>
    <circle class="d-skin" cx="110" cy="64" r="34"/>
    <circle class="d-skin" cx="210" cy="64" r="34"/>
    <circle class="d-skin d-cheek d-cheekL" cx="72" cy="182" r="20"/>
    <circle class="d-skin d-cheek d-cheekR" cx="248" cy="182" r="20"/>
    <ellipse class="d-skin" cx="160" cy="138" rx="110" ry="92"/>
    <path class="d-headshade" d="M72 120 C80 80 120 62 160 62 C200 62 240 80 248 120 C230 96 196 84 160 84 C124 84 90 96 72 120 Z"/>
    <g class="d-eyeL">
      <g class="d-open"><circle class="d-eyewhite" cx="110" cy="70" r="24"/><circle class="d-pupil" cx="113" cy="74" r="10"/><circle class="d-glint" cx="117" cy="69" r="3.5"/></g>
      <path class="d-closed" d="M88 74 Q110 88 132 74"/>
    </g>
    <g class="d-eyeR">
      <g class="d-open"><circle class="d-eyewhite" cx="210" cy="70" r="24"/><circle class="d-pupil" cx="207" cy="74" r="10"/><circle class="d-glint" cx="211" cy="69" r="3.5"/></g>
      <path class="d-closed" d="M188 74 Q210 88 232 74"/>
    </g>
    <ellipse class="d-muzzle" cx="160" cy="182" rx="80" ry="54"/>
    <ellipse class="d-nostril" cx="145" cy="148" rx="5.5" ry="3.5"/>
    <ellipse class="d-nostril" cx="175" cy="148" rx="5.5" ry="3.5"/>
    <ellipse class="d-blush d-blushL" cx="104" cy="198" rx="14" ry="8"/>
    <ellipse class="d-blush d-blushR" cx="216" cy="198" rx="14" ry="8"/>
    <g class="d-acc d-acc-honey"><path class="d-honey" d="M160 160 c-7 0 -11 5 -11 9 c0 5 5 8 11 8 c6 0 11 -3 11 -8 c0 -4 -4 -9 -11 -9 Z M160 176 q2 6 0 10 q-2 -4 0 -10 Z"/></g>
    <g class="d-acc d-acc-crumb"><circle class="d-crumb" cx="154" cy="236" r="4.5"/><circle class="d-crumb" cx="164" cy="240" r="3.5"/><circle class="d-crumb" cx="159" cy="244" r="2.5"/></g>
    <g class="d-acc d-acc-chocL"><path class="d-choc" d="M106 196 c6 -6 14 -2 14 4 c0 6 -6 10 -12 8 c-5 -2 -6 -8 -2 -12 Z"/></g>
    <g class="d-acc d-acc-chocR"><path class="d-choc" d="M214 196 c-6 -6 -14 -2 -14 4 c0 6 6 10 12 8 c5 -2 6 -8 2 -12 Z"/></g>
    <path class="d-lips"/>
    <path class="d-inner"/>
    <g clip-path="url(#CLIP)">
      <rect class="d-teeth" rx="2"/>
      <ellipse class="d-tongue-in"/>
    </g>
    <path class="d-wrinkles"/>
    <g class="d-tongue"><path class="d-tongue-shape"/><path class="d-tongue-line"/></g>
    <path class="d-trill"/>
    <path class="d-blow"/>
    <g class="d-acc d-acc-glasses">
      <circle class="d-glass" cx="110" cy="70" r="29"/><circle class="d-glass" cx="210" cy="70" r="29"/>
      <path class="d-glass-bridge" d="M139 70 Q160 58 181 70"/>
      <path class="d-hair" d="M140 46 c-6 -12 6 -20 12 -12 c2 -12 18 -12 18 0 c8 -8 18 2 10 12"/>
    </g>
    <g class="d-acc d-acc-cap">
      <path class="d-cap" d="M136 52 C150 10 214 -4 262 30 C270 36 266 50 254 52 C230 36 196 34 182 58 Z"/>
      <path class="d-cap-band" d="M134 54 C150 40 170 40 184 58"/>
      <circle class="d-pompom" cx="262" cy="44" r="11"/>
    </g>
  </g>
</svg>`;

let uid = 0;

export class Dino {
  el;
  /** When true the dino blinks and breathes on its own (demo mode). */
  idle = true;
  cur = { ...NEUTRAL };
  tgt = { ...NEUTRAL };
  tg = { x: MCX, y: MCY, rot: 0, len: 0 };
  raf = 0;
  nextBlink = performance.now() + 2000;
  q = {};

  constructor() {
    const id = `dclip${++uid}`;
    const tmp = document.createElement('div');
    tmp.innerHTML = SVG.replace('id="CLIP"', `id="${id}"`).replace('url(#CLIP)', `url(#${id})`);
    this.el = tmp.firstElementChild;
    const pick = (sel) => this.el.querySelector(sel);
    for (const k of ['d-head', 'd-lips', 'd-inner', 'd-clip', 'd-teeth', 'd-tongue-in', 'd-tongue', 'd-tongue-shape', 'd-tongue-line',
      'd-wrinkles', 'd-trill', 'd-blow', 'd-cheekL', 'd-cheekR', 'd-blushL', 'd-blushR', 'd-eyeL', 'd-eyeR', 'd-body']) {
      this.q[k] = pick('.' + k);
    }
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  /** Replace the target face (missing fields fall back to neutral). */
  set(face) {
    this.tgt = { ...NEUTRAL, ...face };
  }

  pose(p) {
    this.set(p ? faceForPose(p) : {});
  }

  wear(acc, on) {
    this.el.querySelector('.d-acc-' + acc)?.classList.toggle('on', on);
  }

  /** Client (page) coordinates of a point in the dino's own drawing. */
  toClient(x = MCX, y = MCY) {
    const ctm = this.el.getScreenCTM();
    if (!ctm) {
      const r = this.el.getBoundingClientRect();
      return { x: r.left + (r.width * x) / 320, y: r.top + (r.height * y) / 300 };
    }
    const p = this.el.createSVGPoint();
    p.x = x;
    p.y = y;
    const o = p.matrixTransform(ctm);
    return { x: o.x, y: o.y };
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.el.remove();
  }

  tick() {
    const now = performance.now();
    const c = this.cur, t = this.tgt;
    let blinkBoost = 0;
    if (this.idle) {
      if (now > this.nextBlink) this.nextBlink = now + 2500 + Math.random() * 3000;
      if (this.nextBlink - now > 2350 && this.nextBlink - now < 2500) blinkBoost = 1;
    }
    for (const k of NUM_KEYS) c[k] = lerp(c[k], t[k], 0.3);
    c.tongue = t.tongue;
    this.render(Math.max(c.blinkL, blinkBoost), Math.max(c.blinkR, blinkBoost), now);
  }

  render(blinkL, blinkR, now) {
    const f = this.cur, q = this.q;
    const breathe = this.idle ? Math.sin(now / 700) * 1.2 : 0;
    q['d-head'].setAttribute('transform', `rotate(${f.tilt.toFixed(2)} 160 222) translate(0 ${breathe.toFixed(2)})`);

    // cheeks
    const sL = 1 + 0.9 * f.puffL, sR = 1 + 0.9 * f.puffR;
    q['d-cheekL'].setAttribute('transform', `translate(${72 - 72 * sL - 8 * f.puffL} ${182 - 182 * sL}) scale(${sL})`);
    q['d-cheekR'].setAttribute('transform', `translate(${248 - 248 * sR + 8 * f.puffR} ${182 - 182 * sR}) scale(${sR})`);
    q['d-blushL'].setAttribute('opacity', String(0.35 + 0.5 * f.puffL));
    q['d-blushR'].setAttribute('opacity', String(0.35 + 0.5 * f.puffR));

    q['d-eyeL'].classList.toggle('shut', blinkL > 0.5);
    q['d-eyeR'].classList.toggle('shut', blinkR > 0.5);

    // mouth
    const cx = MCX, cy = MCY;
    const halfW = 38 * (1 + 0.3 * f.smile) * (1 - 0.55 * f.pucker) * (1 - 0.25 * f.funnel) * (1 - 0.15 * Math.max(f.puffL, f.puffR));
    const open = 2 + 42 * f.jaw + 12 * f.funnel;
    const lift = 9 * f.smile - 3 * f.pucker;
    const lipT = (6 + 6 * f.pucker + 3 * f.funnel) * (1 - 0.85 * f.roll);
    const upY = cy - open * 0.3;
    const loY = cy + open * 0.7 + f.smile * 7;
    const Lx = cx - halfW, Rx = cx + halfW, Cy = cy - lift;
    const k = 0.55 + 0.25 * f.pucker;
    const n = (v) => v.toFixed(1);
    const inner = `M${n(Lx)} ${n(Cy)} C${n(cx - halfW * k)} ${n(upY)} ${n(cx + halfW * k)} ${n(upY)} ${n(Rx)} ${n(Cy)} C${n(cx + halfW * k)} ${n(loY)} ${n(cx - halfW * k)} ${n(loY)} ${n(Lx)} ${n(Cy)}Z`;
    const oL = Lx - lipT * 0.35, oR = Rx + lipT * 0.35, ko = k + 0.05;
    const outer = `M${n(oL)} ${n(Cy)} C${n(cx - halfW * ko)} ${n(upY - lipT * 1.6)} ${n(cx + halfW * ko)} ${n(upY - lipT * 1.6)} ${n(oR)} ${n(Cy)} C${n(cx + halfW * ko)} ${n(loY + lipT * 1.6)} ${n(cx - halfW * ko)} ${n(loY + lipT * 1.6)} ${n(oL)} ${n(Cy)}Z`;
    q['d-lips'].setAttribute('d', outer);
    q['d-inner'].setAttribute('d', inner);
    q['d-clip'].setAttribute('d', inner);
    const teethH = clamp(open * 0.22, 0, 9);
    const teeth = q['d-teeth'];
    teeth.setAttribute('x', n(cx - halfW * 0.6));
    teeth.setAttribute('y', n(upY - 2));
    teeth.setAttribute('width', n(halfW * 1.2));
    teeth.setAttribute('height', n(open > 8 ? teethH + 2 : 0));
    const tin = q['d-tongue-in'];
    const showIn = open > 10 && f.tongue === 'none';
    tin.setAttribute('cx', String(cx));
    tin.setAttribute('cy', n(loY - open * 0.12));
    tin.setAttribute('rx', n(halfW * 0.55));
    tin.setAttribute('ry', n(showIn ? open * 0.25 : 0));
    q['d-wrinkles'].setAttribute('d', `M${cx - 14} ${cy - 10} l2 5 M${cx} ${cy - 12} v6 M${cx + 14} ${cy - 10} l-2 5 M${cx - 10} ${cy + 9} l2 -4 M${cx + 10} ${cy + 9} l-2 -4`);
    q['d-wrinkles'].setAttribute('opacity', n(clamp((f.roll - 0.3) * 1.6)));

    // tongue (outside the mouth)
    let tx = cx, ty = cy + open * 0.35, rot = 0, len = 0;
    switch (f.tongue) {
      case 'out': len = 34; ty = cy + open * 0.2; break;
      case 'down': len = 46; ty = cy + open * 0.35; break;
      case 'up': len = 34; ty = upY - 2; rot = 180; break;
      case 'left': len = 30; tx = Lx + 6; ty = cy + 2; rot = 72; break;
      case 'right': len = 30; tx = Rx - 6; ty = cy + 2; rot = -72; break;
    }
    const g = this.tg;
    g.x = lerp(g.x, tx, 0.35);
    g.y = lerp(g.y, ty, 0.35);
    g.rot = lerp(g.rot, rot, 0.35);
    g.len = lerp(g.len, len, 0.3);
    const w = 26, L = Math.max(g.len, 0.01);
    q['d-tongue'].setAttribute('transform', `translate(${n(g.x)} ${n(g.y)}) rotate(${n(g.rot)})`);
    q['d-tongue'].setAttribute('opacity', g.len > 3 ? '1' : '0');
    q['d-tongue-shape'].setAttribute('d', `M${-w / 2} -4 L${-w / 2} ${n(Math.max(0, L - w / 2))} A${w / 2} ${w / 2} 0 0 0 ${w / 2} ${n(Math.max(0, L - w / 2))} L${w / 2} -4 Z`);
    q['d-tongue-line'].setAttribute('d', `M0 2 L0 ${n(Math.max(2, L - w / 2 - 2))}`);

    // effects
    const trill = q['d-trill'];
    if (f.trill > 0.4) {
      const j = () => (Math.random() * 3).toFixed(1);
      trill.setAttribute('d', `M${Lx - 10} ${cy - 10} l-7 ${j()} l7 5 l-7 5 l7 5 M${Rx + 10} ${cy - 10} l7 ${j()} l-7 5 l7 5 l-7 5`);
      trill.setAttribute('opacity', '1');
    } else trill.setAttribute('opacity', '0');
    const blow = q['d-blow'];
    if (f.blow > 0.05) {
      const s = 10 + f.blow * 28;
      blow.setAttribute('d', `M${Rx + 8} ${cy - 6} q${s * 0.6} -6 ${s} 0 M${Rx + 10} ${cy + 2} q${s * 0.7} 0 ${s * 1.3} 4 M${Rx + 8} ${cy + 10} q${s * 0.6} 6 ${s} 6`);
      blow.setAttribute('opacity', n(clamp(f.blow * 1.5)));
    } else blow.setAttribute('opacity', '0');
  }
}
