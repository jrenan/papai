// Render lightweight fallback portraits and export reusable Three.js models.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: path.join(root, 'dia-e-noite/vendor/three.min.js') });
    await page.addScriptTag({ path: path.join(root, 'dia-e-noite/astronauts.js') });
    for (const member of [{ name: 'Leo', variant: 'blue' }, { name: 'Rafa', variant: 'red' }]) {
      const result = await page.evaluate(member => {
        const T = window.THREE;
        const scene = new T.Scene();
        const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.setSize(512, 640); renderer.outputEncoding = T.sRGBEncoding;
        const camera = new T.OrthographicCamera(-1.36, 1.36, 1.7, -1.7, .1, 30);
        camera.position.set(0, 0, 8);
        scene.add(new T.HemisphereLight('#eaf6ff', '#798baf', .6));
        const key = new T.DirectionalLight('#fff1d8', .75); key.position.set(-3, 5, 6); scene.add(key);
        const rim = new T.DirectionalLight('#8ccfff', .35); rim.position.set(4, 1, -2); scene.add(rim);
        const model = window.TrioAstronauts.create(T, member);
        const exported = model.toJSON();
        const bounds = new T.Box3().setFromObject(model);
        model.position.sub(bounds.getCenter(new T.Vector3()));
        scene.add(model); renderer.render(scene, camera);
        const png = renderer.domElement.toDataURL('image/png').split(',')[1];
        renderer.dispose(); renderer.forceContextLoss();
        return { png, exported };
      }, member);
      fs.writeFileSync(path.join(root, `dia-e-noite/astronaut-${member.variant}.png`), Buffer.from(result.png, 'base64'));
      const modelDirectory = path.join(root, 'dia-e-noite/models');
      fs.mkdirSync(modelDirectory, { recursive: true });
      fs.writeFileSync(path.join(modelDirectory, `${member.name.toLowerCase()}-astronauta.json`), JSON.stringify(result.exported));
      console.log(`Rendered ${member.name}: transparent fallback and reusable Three.js model`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
