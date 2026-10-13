export async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador não dá acesso à câmera. Abra pelo Safari ou Chrome, em https.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
    audio: false,
  });
  const v = document.createElement('video');
  v.setAttribute('playsinline', '');
  v.setAttribute('autoplay', '');
  v.muted = true;
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
    get width() { return v.videoWidth; },
    get height() { return v.videoHeight; },
    isVideo: true,
    stop() {
      stream.getTracks().forEach((t) => t.stop());
      v.srcObject = null;
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
    await v.play();
    return {
      el: v,
      get width() { return v.videoWidth; },
      get height() { return v.videoHeight; },
      isVideo: true,
      stop() { v.pause(); },
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
