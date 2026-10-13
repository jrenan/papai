export const MIC_CONSTRAINTS = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

export async function openCamera({ mic = false } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador não dá acesso à câmera. Abra pelo Safari ou Chrome, em https.');
  }
  const video = { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } };
  let stream;
  let micError = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video, audio: mic ? MIC_CONSTRAINTS : false });
  } catch (error) {
    if (!mic) throw error;
    // A denied/unavailable microphone must not take away the camera.
    micError = error;
    stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
  }
  stream.getAudioTracks().forEach((t) => { t.enabled = false; });
  const v = document.createElement('video');
  v.setAttribute('playsinline', '');
  v.setAttribute('autoplay', '');
  v.muted = true;
  // Keep the capture element connected across screens. Moving a live video
  // between mirrors can suspend playback in Safari on iPhone.
  document.getElementById('video-holder').append(v);
  v.srcObject = stream;
  await v.play().catch(() => undefined);
  if (!v.videoWidth) {
    await new Promise((r) => {
      v.addEventListener('loadedmetadata', () => r(), { once: true });
      setTimeout(r, 3000);
    });
  }
  return {
    el: v,
    stream,
    micError,
    get width() { return v.videoWidth; },
    get height() { return v.videoHeight; },
    isVideo: true,
    resume() { return v.play(); },
    stop() {
      stream.getTracks().forEach((t) => t.stop());
      v.srcObject = null;
      v.remove();
    },
  };
}

/** Dev/testing: drive the pipeline from an image or looping video URL instead of the camera. */
export async function openTestSource(url) {
  if (/\.(mp4|webm|mov)$/i.test(url)) {
    const v = document.createElement('video');
    v.src = url;
    v.loop = true;
    v.muted = true;
    v.setAttribute('playsinline', '');
    document.getElementById('video-holder').append(v);
    await v.play();
    return {
      el: v,
      get width() { return v.videoWidth; },
      get height() { return v.videoHeight; },
      isVideo: true,
      stop() { v.pause(); v.remove(); },
    };
  }
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`não abriu ${url}`));
    img.src = url;
  });
  return { el: img, width: img.naturalWidth, height: img.naturalHeight, isVideo: false, stop() {} };
}
