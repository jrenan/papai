import { FaceLandmarker, FilesetResolver } from '../../vendor/mediapipe-0.10.35/vision_bundle.js';
import { dist, mid } from '../util.js';
import { TongueAnalyzer } from './tongue.js';

/**
 * MediaPipe face mesh indices. "R"/"L" are the SUBJECT's right/left
 * (in the raw, un-mirrored camera image the subject's right is on the image left).
 */
export const LM = {
  eyeOuterR: 33, eyeOuterL: 263,
  cornerR: 61, cornerL: 291,
  upperLipTop: 0, upperInner: 13, lowerInner: 14, lowerLipBottom: 17,
  noseTip: 1,
  jawR: 58, jawL: 288, jawR2: 132, jawL2: 361,
};

let landmarkerPromise = null;

export function loadLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const base = new URL('./', document.baseURI).href;
      const fileset = await FilesetResolver.forVisionTasks(base + 'vendor/mediapipe-0.10.35/wasm');
      const make = (delegate) =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: base + 'models/face_landmarker.task', delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      try {
        return await make('GPU');
      } catch (e) {
        console.warn('GPU delegate falhou, usando CPU', e);
        return await make('CPU');
      }
    })();
    landmarkerPromise.catch(() => { landmarkerPromise = null; });
  }
  return landmarkerPromise;
}

export function computeMetrics(p) {
  const eR = p[LM.eyeOuterR], eL = p[LM.eyeOuterL];
  const iod = Math.max(1, dist(eR, eL));
  const U = { x: (eL.x - eR.x) / iod, y: (eL.y - eR.y) / iod };
  const V = { x: -U.y, y: U.x };
  const C = mid(p[LM.upperInner], p[LM.lowerInner]);
  const eyeMid = mid(eR, eL);
  const nose = p[LM.noseTip];
  const yaw = ((nose.x - eyeMid.x) * U.x + (nose.y - eyeMid.y) * U.y) / iod;
  const openIn = (dist(p[82], p[87]) + dist(p[13], p[14]) + dist(p[312], p[317])) / 3 / iod;
  const leftSide = dist(nose, p[LM.jawL]) + dist(nose, p[LM.jawL2]);
  const rightSide = dist(nose, p[LM.jawR]) + dist(nose, p[LM.jawR2]);
  return {
    iod, C, U, V,
    roll: Math.atan2(U.y, U.x),
    yaw,
    mouthW: dist(p[LM.cornerR], p[LM.cornerL]) / iod,
    openIn,
    upperLip: dist(p[LM.upperLipTop], p[LM.upperInner]) / iod,
    lowerLip: dist(p[LM.lowerInner], p[LM.lowerLipBottom]) / iod,
    cheekW: (dist(p[LM.jawR], p[LM.jawL]) + dist(p[LM.jawR2], p[LM.jawL2])) / 2 / iod,
    cheekAsym: (leftSide - rightSide) / 2 / iod,
  };
}

const EMPTY = (t) => ({ t, present: false, quality: 'none', bs: {}, pts: [], m: null, tongue: null });

/** Runs the landmarker on every new camera frame and emits enriched FaceFrames. */
export class FaceTracker {
  tongue = new TongueAnalyzer();
  onFrame = null;
  fps = 0;
  raf = 0;
  running = false;
  lastVideoTime = -1;
  lastT = 0;
  fpsCount = 0;
  fpsT0 = 0;

  constructor(lm, src) {
    this.lm = lm;
    this.src = src;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.step();
    };
    loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  step() {
    const s = this.src;
    const now = performance.now();
    if (s.isVideo) {
      const v = s.el;
      if (v.readyState < 2 || !v.videoWidth) return;
      if (v.currentTime === this.lastVideoTime) return;
      this.lastVideoTime = v.currentTime;
    } else if (now - this.lastT < 33) {
      return;
    }
    const t = Math.max(now, this.lastT + 1);
    this.lastT = t;
    let res;
    try {
      res = this.lm.detectForVideo(s.el, t);
    } catch (e) {
      console.warn('detectForVideo', e);
      return;
    }
    this.fpsCount++;
    if (now - this.fpsT0 > 1000) {
      this.fps = (this.fpsCount * 1000) / (now - this.fpsT0);
      this.fpsCount = 0;
      this.fpsT0 = now;
    }
    this.onFrame?.(this.build(res, t));
  }

  build(res, t) {
    const w = this.src.width, h = this.src.height;
    const lms = res.faceLandmarks?.[0];
    if (!lms || !lms.length) return EMPTY(t);
    const pts = lms.map((l) => ({ x: l.x * w, y: l.y * h }));
    const bs = {};
    for (const c of res.faceBlendshapes?.[0]?.categories ?? []) bs[c.categoryName] = c.score;
    const m = computeMetrics(pts);
    let quality = 'ok';
    if (m.iod < Math.min(w, h) * 0.11) quality = 'far';
    else if (Math.abs(m.yaw) > 0.24) quality = 'turned';
    const tongue = quality === 'far' ? null : this.tongue.analyze(this.src, m, pts);
    return { t, present: true, quality, bs, pts, m, tongue };
  }
}
