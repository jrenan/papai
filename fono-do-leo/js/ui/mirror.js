import { engine } from '../engine/engine.js';
import { C_DARK, C_RED, C_TEETH, GH, GW, INNER_LIPS, OUTER_LIPS, PX, U0, V0 } from '../engine/tongue.js';
import { clamp, h, lerp } from '../util.js';

/**
 * The "magic mirror": Leo's camera image, mirrored and gently zoomed onto his
 * face. Draw from the persistent capture element without moving it between
 * screens; Safari may pause a live video when it is detached/reparented.
 */
export class Mirror {
  el;
  overlay = false;
  canvas;
  ctx;
  raf = 0;
  z = 1;
  cx = -1;
  cy = -1;

  constructor() {
    this.canvas = h('canvas', { class: 'mirror-overlay mirror-media' });
    this.ctx = this.canvas.getContext('2d');
    this.el = h('div', { class: 'mirror' }, this.canvas);
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  tick() {
    const src = engine.src;
    if (!src || !src.width) return;
    const media = src.el;
    if (src.isVideo && media.readyState < 2) return;
    const bw = this.el.clientWidth, bh = this.el.clientHeight;
    if (!bw || !bh) return;
    const vw = src.width, vh = src.height;
    const s0 = Math.max(bw / vw, bh / vh);
    const f = engine.last;
    let tz = 1, tcx = vw / 2, tcy = vh / 2;
    if (f?.present && f.pts.length) {
      const p = f.pts;
      const top = p[10], chin = p[152], l = p[234], r = p[454];
      const fh = Math.hypot(top.x - chin.x, top.y - chin.y);
      tz = clamp((0.72 * bh) / (fh * s0), 1, 2.4);
      tcx = (top.x + chin.x + l.x + r.x) / 4;
      tcy = (top.y + chin.y + l.y + r.y) / 4;
    }
    if (this.cx < 0) { this.cx = tcx; this.cy = tcy; }
    this.z = lerp(this.z, tz, 0.06);
    this.cx = lerp(this.cx, tcx, 0.1);
    this.cy = lerp(this.cy, tcy, 0.1);
    const s = s0 * this.z;
    const halfW = bw / (2 * s), halfH = bh / (2 * s);
    const cx = halfW * 2 >= vw ? vw / 2 : clamp(this.cx, halfW, vw - halfW);
    const cy = halfH * 2 >= vh ? vh / 2 : clamp(this.cy, halfH, vh - halfH);
    const e = bw / 2 + cx * s, fy = bh / 2 - cy * s;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(bw * dpr) || this.canvas.height !== Math.round(bh * dpr)) {
      this.canvas.width = Math.round(bw * dpr);
      this.canvas.height = Math.round(bh * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(-s * dpr, 0, 0, s * dpr, e * dpr, fy * dpr);
    ctx.drawImage(media, 0, 0, vw, vh);
    if (this.overlay && f?.present && f.m) {
      this.drawDebug(f, s);
    }
  }

  drawDebug(f, s) {
    const ctx = this.ctx;
    const p = f.pts;
    const poly = (idx, color) => {
      ctx.beginPath();
      idx.forEach((i, k) => (k ? ctx.lineTo(p[i].x, p[i].y) : ctx.moveTo(p[i].x, p[i].y)));
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / s;
      ctx.stroke();
    };
    poly(OUTER_LIPS, 'rgba(80,220,120,.9)');
    poly(INNER_LIPS, 'rgba(255,220,60,.9)');
    const t = engine.tracker?.tongue;
    const m = f.m;
    if (!t) return;
    const step = m.iod / PX;
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        const i = gy * GW + gx;
        const c = t.cls[i];
        if (!t.ev[i] && c !== C_RED && c !== C_DARK && c !== C_TEETH) continue;
        const u = (gx + 0.5) / PX + U0, v = (gy + 0.5) / PX + V0;
        const x = m.C.x + (m.U.x * u + m.V.x * v) * m.iod;
        const y = m.C.y + (m.U.y * u + m.V.y * v) * m.iod;
        ctx.fillStyle = t.ev[i] ? 'rgba(255,40,140,.75)' : c === C_RED ? 'rgba(255,140,0,.25)' : c === C_DARK ? 'rgba(0,0,80,.25)' : 'rgba(255,255,255,.3)';
        ctx.fillRect(x - step / 2, y - step / 2, step, step);
      }
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.el.remove();
  }
}
