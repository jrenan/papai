/* A fixed Sun, one rotating Earth, and one shared angle for both views. */
(() => {
  'use strict';
  const M = window.DayNightModel;
  const $ = id => document.getElementById(id);
  let spaceCanvas = $('spaceCanvas'), skyCanvas = $('skyCanvas');
  const range = $('rotation');
  const copy = {
    day: ['É dia!', 'A luz do Sol chega a este lugar.'],
    sunset: ['Entardecer', 'Este lugar está saindo da luz do Sol.'],
    night: ['É noite!', 'Este lugar está virado para longe do Sol.'],
    sunrise: ['Amanhecer', 'Este lugar está voltando para a luz do Sol.'],
  };
  let angle = 0, playing = false, tween = null, interacted = false, challenge = false;
  let phase = '', lastFrame = 0, dirty = true, renderScenes, resizeScenes;
  let turnProgress = 0, tilt = 0.28;
  let lesson = null, lessonLocked = false, observerIndex = 0, otherPlaceVisible = false;
  let wasCrewMoving = false;
  const observedState = () => M.getState(angle + (observerIndex ? Math.PI : 0));
  let manifest = null, audio = null, audioEnabled = false, pendingNarration = null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const crew = [{ name: 'Leo', variant: 'blue', u: .29, v: .23 }, { name: 'Rafa', variant: 'red', u: .29, v: .75 }];
  let crewMoving = !reducedMotion, crewTime = 0, lastCrewFrame = 0, spaceVisible = true;
  function updateCrewControl() {
    const button = $('crewMotion');
    const label = `${crewMoving ? 'Pausar' : 'Retomar'} flutuação dos astronautas`;
    button.setAttribute('aria-pressed', String(!crewMoving));
    button.setAttribute('aria-label', label); button.title = label;
    button.querySelector('use').setAttribute('href', crewMoving ? '#i-pause' : '#i-play');
  }
  $('crewMotion').onclick = () => { crewMoving = !crewMoving; updateCrewControl(); dirty = true; };
  updateCrewControl();
  crew.forEach(member => { $(`${member.variant}AstronautName`).textContent = member.name; });
  const fallbackCrew = crew.map(member => {
    const image = new Image(); image.onload = () => { dirty = true; };
    return { ...member, image };
  });
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = 1536; mapCanvas.height = 768;
  const mapContext = mapCanvas.getContext('2d');
  const stars = Array.from({ length: 100 }, (_, i) => ({ x: fract(Math.sin(i * 97.37 + 1) * 4258), y: fract(Math.sin(i * 43.21 + 3) * 8347), r: i % 7 === 0 ? 1.6 : 0.8 }));
  function fract(x) { return x - Math.floor(x); }
  function paintMap(geo) {
    mapContext.fillStyle = '#2387bd'; mapContext.fillRect(0, 0, 1536, 768);
    mapContext.strokeStyle = '#63b6cf'; mapContext.lineWidth = 1;
    for (let lat = 30; lat < 180; lat += 30) { mapContext.beginPath(); mapContext.moveTo(0, lat / 180 * 768); mapContext.lineTo(1536, lat / 180 * 768); mapContext.stroke(); }
    for (let lon = 0; lon < 360; lon += 30) { mapContext.beginPath(); mapContext.moveTo(lon / 360 * 1536, 0); mapContext.lineTo(lon / 360 * 1536, 768); mapContext.stroke(); }
    const fallback = [[[-165,65],[-130,70],[-65,50],[-85,10],[-115,25]], [[-82,10],[-45,0],[-36,-12],[-70,-55],[-78,-20]], [[-15,35],[30,38],[50,10],[20,-35],[-10,5]], [[-10,38],[-10,70],[80,72],[150,55],[130,10],[70,10],[40,35]], [[110,-10],[155,-12],[150,-40],[115,-33]]];
    const polygons = geo ? geo.features.flatMap(f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) : fallback.map(r => [r]);
    for (const polygon of polygons) {
      mapContext.beginPath();
      for (const ring of polygon) {
        let previous = null;
        ring.forEach(([lon, lat], i) => {
          const x = (lon + 180) / 360 * 1536, y = (90 - lat) / 180 * 768;
          if (i === 0 || (previous !== null && Math.abs(previous - lon) > 180)) mapContext.moveTo(x, y);
          else mapContext.lineTo(x, y);
          previous = lon;
        });
        mapContext.closePath();
      }
      mapContext.fillStyle = '#79c877'; mapContext.fill('evenodd');
    }
    mapContext.fillStyle = '#deefeb'; mapContext.fillRect(0, 0, 1536, 25); mapContext.fillRect(0, 724, 1536, 44);
  }
  paintMap();
  let earthTexture;
  fetch('../data/countries-lite.geojson').then(r => { if (!r.ok) throw new Error('map'); return r.json(); }).then(geo => { paintMap(geo); if (earthTexture) earthTexture.needsUpdate = true; dirty = true; }).catch(() => {});
  let manifestRequest = null;
  function loadManifest() {
    if (manifest) return Promise.resolve(manifest);
    if (!manifestRequest) manifestRequest = fetch('audio/manifest.json').then(r => { if (!r.ok) throw new Error('audio'); return r.json(); }).then(data => { manifest = data; $('listenButton').hidden = data.available === false; $('voiceCredit').hidden = data.available === false; return data; }).finally(() => { manifestRequest = null; });
    return manifestRequest;
  }
  loadManifest().catch(() => {});

  function stopAudio() {
    pendingNarration = null;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    $('listenButton').dataset.playing = 'false';
    $('listenButton').querySelector('span').textContent = 'Ouvir';
  }
  function narrate(id, explicit = false) {
    if (!manifest || manifest.available === false) return;
    if (!audioEnabled && !explicit) return;
    if (explicit) audioEnabled = true;
    const clip = manifest?.clips?.[id];
    if (!clip) { if (explicit) $('audioStatus').textContent = 'A voz ainda não carregou. Toque em Ouvir para tentar de novo.'; return; }
    if (!explicit && audio && !audio.paused) { pendingNarration = id; return; }
    stopAudio();
    const path = clip.file || clip.path || `${id}.mp3`;
    audio = new Audio(path.startsWith('audio/') ? path : `audio/${path}`);
    audio.preload = 'auto';
    const current = audio;
    audio.onended = () => {
      if (current !== audio) return;
      $('listenButton').dataset.playing = 'false'; $('listenButton').querySelector('span').textContent = 'Ouvir';
      const next = pendingNarration; pendingNarration = null;
      if (next && next === observedState().phase) narrate(next);
    };
    audio.onerror = () => { if (current === audio) { stopAudio(); $('audioStatus').textContent = 'Não deu para ouvir. Toque em Ouvir para tentar de novo.'; } };
    audio.play().then(() => {
      if (current !== audio) return;
      $('audioStatus').textContent = ''; $('listenButton').dataset.playing = 'true'; $('listenButton').querySelector('span').textContent = 'Pausar voz';
    }).catch(() => { if (current === audio) { stopAudio(); $('audioStatus').textContent = 'Toque em Ouvir para liberar a voz.'; } });
  }
  function setPlaying(value) {
    playing = value;
    $('playButton').setAttribute('aria-pressed', String(value));
    $('playButton').querySelector('span').textContent = value ? 'Pausar' : 'Girar sozinha';
    $('playButton').querySelector('use').setAttribute('href', value ? '#i-pause' : '#i-play');
  }
  function manual() { setPlaying(false); tween = null; interacted = true; stopAudio(); $('dragHint').style.opacity = '0.6'; }
  function setAngle(value, fromUser = false) {
    const delta = value - angle;
    angle = value;
    if (fromUser || playing) {
      turnProgress += delta;
      if (Math.abs(turnProgress) >= M.TAU - 0.000001) { turnProgress = 0; if (!challenge) $('challengeStatus').textContent = 'Uma volta inteira! Passaram o dia e a noite.'; narrate('full-turn'); }
    }
    dirty = true;
    updateUI();
  }
  function updateUI() {
    const state = observedState();
    range.value = (M.normalize(angle) / M.TAU * 360).toFixed(2);
    range.setAttribute('aria-valuetext', copy[state.phase][0]);
    if (state.phase !== phase) {
      phase = state.phase;
      $('phaseTitle').textContent = copy[phase][0]; $('phaseTitle').dataset.phase = phase;
      $('phaseText').textContent = copy[phase][1];
      $('skyView').dataset.phase = phase;
      skyCanvas.setAttribute('aria-label', `${copy[phase][0]} ${copy[phase][1]}`);
      document.querySelectorAll('[data-phase]').forEach(button => { if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.phase === phase)); });
      if (playing) narrate(phase);
    }
    $('skyView').dataset.observer = observerIndex ? 'other' : 'home';
    $('skyHeading').textContent = observerIndex ? 'O céu no outro lugar' : 'O céu no nosso lugar';
    $('placeName').textContent = observerIndex ? 'Outro lugar na Terra' : 'Nosso lugar na Terra';
    $('placeLegend').dataset.observer = observerIndex ? 'other' : 'home';
    $('placeLegendText').textContent = observerIndex ? 'Outro lugar nas duas vistas' : 'Nosso lugar nas duas vistas';
    if (challenge && state.elevation > 0.55) {
      challenge = false;
      $('challengeStatus').textContent = 'Você descobriu! Nosso lugar recebeu luz. Ficou de dia!';
      $('challengeStatus').dataset.status = 'complete';
      document.querySelector('.discovery').dataset.complete = 'true';
      $('challengeButton').textContent = 'Descobrir de novo';
      setPlaying(false); narrate('day');
    }
    lesson?.update({ ...M.getState(angle), angle, settled: !tween });
  }
  function goTo(target) {
    manual(); turnProgress = 0;
    const start = angle;
    let distance = M.normalize(target - M.normalize(angle));
    if (distance < 0.01) distance = 0;
    if (reducedMotion) setAngle(start + distance);
    else tween = { start, distance, elapsed: 0, duration: Math.min(1.3, 0.5 + distance * 0.15) };
  }
  $('playButton').onclick = () => { if (lessonLocked) return; interacted = true; tween = null; setPlaying(!playing); if (playing) narrate(phase); };
  $('resetButton').onclick = () => { manual(); challenge = false; turnProgress = 0; tilt = 0.28; $('challengeStatus').textContent = 'A Terra gira. O dia vira noite. E começa outro dia!'; $('challengeStatus').dataset.status = ''; document.querySelector('.discovery').dataset.complete = 'false'; $('challengeButton').textContent = 'Vamos descobrir?'; setAngle(0); };
  range.addEventListener('input', () => {
    if (lessonLocked) return;
    const value = Number(range.value) * M.TAU / 360;
    const delta = M.normalize(value - M.normalize(angle) + Math.PI) - Math.PI;
    manual(); setAngle(angle + delta, true);
  });
  document.querySelectorAll('button[data-phase]').forEach(button => button.onclick = () => { if (document.body.dataset.lessonActive === 'true') return; goTo(M.targets[button.dataset.phase]); narrate(button.dataset.phase); });
  $('listenButton').onclick = async () => {
    if (audio && !audio.paused) { stopAudio(); return; }
    if (!manifest) {
      $('listenButton').disabled = true;
      try { await loadManifest(); } catch (_) { $('audioStatus').textContent = 'Não deu para carregar a voz. Toque em Ouvir para tentar de novo.'; return; }
      finally { $('listenButton').disabled = false; }
    }
    narrate(challenge ? 'challenge' : interacted ? phase : 'intro', true);
  };
  $('challengeButton').onclick = () => {
    manual(); turnProgress = 0; setAngle(Math.PI); challenge = true;
    $('challengeStatus').textContent = 'Está de noite. Gire a Terra até o Sol iluminar nosso lugar!';
    $('challengeStatus').dataset.status = 'active';
    document.querySelector('.discovery').dataset.complete = 'false';
    $('challengeButton').textContent = 'Recomeçar desafio';
    narrate('challenge', true);
  };

  function setup3D() {
    const T = window.THREE;
    if (!T) throw new Error('3D unavailable');
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) throw new Error('3D unavailable');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const renderer = new T.WebGLRenderer({ canvas: spaceCanvas, antialias: true, alpha: false });
    const gardenRenderer = new T.WebGLRenderer({ canvas: skyCanvas, antialias: true, alpha: false });
    for (const r of [renderer, gardenRenderer]) { r.setPixelRatio(Math.min(devicePixelRatio, 1.8)); r.outputEncoding = T.sRGBEncoding; }
    const scene = new T.Scene(); scene.background = new T.Color('#101c39');
    const camera = new T.OrthographicCamera(-5, 5, 3.5, -3.5, 0.1, 100);
    const earthRoot = new T.Group(); earthRoot.position.set(.65, -.05, 0); scene.add(earthRoot);
    const spinningEarth = new T.Group(); earthRoot.add(spinningEarth);
    earthTexture = new T.CanvasTexture(mapCanvas); earthTexture.encoding = T.sRGBEncoding;
    earthTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const earth = new T.Mesh(new T.SphereGeometry(1.64, 72, 48), new T.MeshPhongMaterial({ map: earthTexture, shininess: 10, specular: '#23566e' }));
    spinningEarth.add(earth);
    const atmosphere = new T.Mesh(new T.SphereGeometry(1.675, 64, 40), new T.MeshBasicMaterial({ color:'#62bde0', transparent:true, opacity:.13, side:T.BackSide })); earthRoot.add(atmosphere);
    scene.add(new T.AmbientLight('#b4d2ff', .09));
    const sunLight = new T.DirectionalLight('#fff3d2', 1.65); sunLight.position.set(-10, 0, 0); sunLight.target = earthRoot; scene.add(sunLight);
    const sun = new T.Mesh(new T.SphereGeometry(.48, 32, 24), new T.MeshBasicMaterial({ color: '#ffd364' })); sun.position.set(-2.95, 0, 0); scene.add(sun);
    const glowCanvas = document.createElement('canvas'); glowCanvas.width=128;glowCanvas.height=128;
    const gc=glowCanvas.getContext('2d'), gradient=gc.createRadialGradient(64,64,10,64,64,64);gradient.addColorStop(0,'#ffdf91cc');gradient.addColorStop(.4,'#ffc05a44');gradient.addColorStop(1,'#ffc05a00');gc.fillStyle=gradient;gc.fillRect(0,0,128,128);
    const glow = new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(glowCanvas),transparent:true,depthWrite:false}));glow.position.copy(sun.position);glow.scale.set(2.5,2.5,1);scene.add(glow);
    for (let y=-.55;y<=.56;y+=.55) {
      const line=new T.BufferGeometry().setFromPoints([new T.Vector3(-2.25,y,0),new T.Vector3(-1.3,y,0)]);
      scene.add(new T.Line(line,new T.LineBasicMaterial({color:'#ffe1a0',transparent:true,opacity:.5})));
      const head=new T.Mesh(new T.ConeGeometry(.045,.14,6),new T.MeshBasicMaterial({color:'#ffe1a0'}));head.rotation.z=-Math.PI/2;head.position.set(-1.27,y,0);scene.add(head);
    }
    const axis = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0,-2,0),new T.Vector3(0,2,0)]),new T.LineDashedMaterial({color:'#90a8cd',dashSize:.09,gapSize:.09,transparent:true,opacity:.55}));axis.computeLineDistances();earthRoot.add(axis);
    const markerBase = new T.Vector3(Math.cos(50*Math.PI/180),0,Math.sin(50*Math.PI/180));
    const marker = new T.Group();marker.position.copy(markerBase.clone().multiplyScalar(1.65));marker.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),markerBase);spinningEarth.add(marker);
    const markerMat = new T.MeshBasicMaterial({color:'#ed5b86'});
    const pin=new T.Mesh(new T.CylinderGeometry(.018,.018,.2,8),new T.MeshBasicMaterial({color:'#fff4df'}));pin.position.y=.1;marker.add(pin);
    const pinhead=new T.Mesh(new T.SphereGeometry(.095,16,12),markerMat);pinhead.position.y=.25;marker.add(pinhead);
    const pinRing=new T.Mesh(new T.TorusGeometry(.13,.018,8,32),new T.MeshBasicMaterial({color:'#ffffff'}));pinRing.rotation.x=Math.PI/2;pinRing.position.y=.02;marker.add(pinRing);
    const oppositeBase=markerBase.clone().negate();
    const otherMarker=marker.clone(true);otherMarker.position.copy(oppositeBase.clone().multiplyScalar(1.65));otherMarker.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),oppositeBase);
    const otherPin=otherMarker.children[1];otherPin.material=new T.MeshBasicMaterial({color:'#36bfa0'});otherPin.geometry=new T.OctahedronGeometry(.11);
    otherMarker.visible=false;spinningEarth.add(otherMarker);
    const starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.Float32BufferAttribute(stars.flatMap(s=>[(s.x-.5)*18,(s.y-.5)*13,-5]),3));scene.add(new T.Points(starGeo,new T.PointsMaterial({color:'#d6e8ff',size:.026,transparent:true,opacity:.65})));

    // A separate foreground scene lights the children without changing Earth's night side.
    const crewScene = new T.Scene();
    const crewCamera = new T.OrthographicCamera(-5, 5, 3.5, -3.5, .1, 30);
    crewCamera.position.set(0, 0, 8);
    crewScene.add(new T.HemisphereLight('#eaf6ff', '#798baf', .6));
    const crewLight = new T.DirectionalLight('#fff1d8', .75);
    crewLight.position.set(-3, 5, 6); crewScene.add(crewLight);
    const crewRim = new T.DirectionalLight('#8ccfff', .35);
    crewRim.position.set(4, 1, -2); crewScene.add(crewRim);
    const astronauts = crew.map(member => {
      const model = window.TrioAstronauts.create(T, member);
      const bounds = new T.Box3().setFromObject(model);
      const size = bounds.getSize(new T.Vector3());
      model.position.sub(bounds.getCenter(new T.Vector3()));
      const holder = new T.Group(); holder.add(model); crewScene.add(holder);
      return { ...member, model, holder, size };
    });

    const garden = new T.Scene();
    const gardenCamera=new T.PerspectiveCamera(47,1,.1,150);gardenCamera.position.set(0,2.6,8);gardenCamera.lookAt(0,2,-5);
    const nightColor=new T.Color('#101d43'),dayColor=new T.Color('#8bd9ee'),twilightColor=new T.Color('#f2ae83');
    const ambient=new T.HemisphereLight('#e3f4ff','#44875c',1);garden.add(ambient);
    const daylight=new T.DirectionalLight('#fff1cd',1.8);garden.add(daylight);garden.add(daylight.target);daylight.target.position.set(0,0,-2);
    function mesh(geometry,color,x,y,z,parent=garden){const m=new T.Mesh(geometry,new T.MeshLambertMaterial({color}));m.position.set(x,y,z);parent.add(m);return m;}
    mesh(new T.PlaneGeometry(120,120),'#6da752',0,0,-20).rotation.x=-Math.PI/2;
    mesh(new T.PlaneGeometry(1.4,20),'#dfc191',.8,.012,-1).rotation.x=-Math.PI/2;
    for(const [x,z,s] of [[-5,-6,1.1],[5,-9,1.2],[-7,-14,1.5],[7,-18,1.5],[-3.7,-17,1.2]]){
      mesh(new T.CylinderGeometry(.14*s,.23*s,1.9*s,7),'#8c6141',x,.95*s,z);
      mesh(new T.IcosahedronGeometry(1.2*s,1),'#508f53',x,2.5*s,z);
      mesh(new T.IcosahedronGeometry(.85*s,1),'#72aa55',x-.55*s,2*s,z+.2);
    }
    for(const [x,z,s] of [[-17,-34,12],[10,-40,15],[27,-42,14]]){const hill=mesh(new T.SphereGeometry(s,28,16),'#659969',x,-s*.72,z);hill.scale.z=.5;}
    const home = new T.Group();home.position.set(3.35,0,-7);garden.add(home);
    mesh(new T.BoxGeometry(2.6,2,2.3),'#f7dfad',0,1,0,home);
    const roof=mesh(new T.ConeGeometry(2.15,1.35,4),'#cc7654',0,2.65,0,home);roof.rotation.y=Math.PI/4;
    mesh(new T.BoxGeometry(.58,1.2,.04),'#5f7884',.3,.6,1.17,home);
    const windowMaterial = new T.MeshBasicMaterial({color:'#fff4c3'});
    for(const x of [-.78,.88]){const w=new T.Mesh(new T.BoxGeometry(.5,.55,.05),windowMaterial);w.position.set(x,1.35,1.18);home.add(w);}
    for(let i=0;i<9;i++){mesh(new T.BoxGeometry(.1,.7,.09),'#e8dfbd',-4.7+i*.5,.35,-4);}
    mesh(new T.BoxGeometry(4.2,.09,.08),'#e8dfbd',-2.7,.48,-4);
    // The pink observer matches the pin on Earth. Seen from just behind their shoulder.
    const child = new T.Group();child.position.set(-1.7,0,.45);garden.add(child);
    const childShirt=mesh(new T.CylinderGeometry(.19,.26,.55,10),'#ec5c84',0,.85,0,child);
    mesh(new T.SphereGeometry(.23,20,16),'#c58b60',0,1.34,0,child);
    const hair=mesh(new T.SphereGeometry(.24,20,12,0,Math.PI*2,0,Math.PI*.6),'#453b37',0,1.38,0,child);
    hair.rotation.x=-.15;
    for(const x of [-.12,.12]){mesh(new T.CylinderGeometry(.075,.065,.42,8),'#384e77',x,.34,0,child);mesh(new T.BoxGeometry(.16,.1,.26),'#f1d694',x,.09,-.04,child);}
    for(const x of [-.28,.28]){const arm=mesh(new T.CylinderGeometry(.065,.065,.48,8),'#c58b60',x,.81,0,child);arm.rotation.z=x>0?-.15:.15;}
    const shadow=mesh(new T.CircleGeometry(.5,32),'#588349',-1.7,.022,.45);shadow.rotation.x=-Math.PI/2;shadow.scale.y=.6;
    const skySun=new T.Mesh(new T.SphereGeometry(.55,24,20),new T.MeshBasicMaterial({color:'#ffed9b'}));garden.add(skySun);
    const cloudMaterial=new T.MeshBasicMaterial({color:'#eefbff',transparent:true,opacity:.85});
    const clouds=new T.Group();garden.add(clouds);
    for(const [x,y,z] of [[-5,5.5,-15],[5.5,6.7,-19],[-1,7,-23]]){for(let i=0;i<3;i++){const c=new T.Mesh(new T.SphereGeometry(.55+i*.1,16,12),cloudMaterial);c.position.set(x+i*.65,y+(i===1?.2:0),z);c.scale.y=.55;clouds.add(c);}}
    const nightStarsGeometry=new T.BufferGeometry();nightStarsGeometry.setAttribute('position',new T.Float32BufferAttribute(stars.slice(0,65).flatMap(s=>[(s.x-.5)*42,4+s.y*17,-35]),3));const starMaterial=new T.PointsMaterial({color:'#e6edff',size:.065,transparent:true});garden.add(new T.Points(nightStarsGeometry,starMaterial));
    const position=new T.Vector3();
    resizeScenes = () => {
      const a=spaceCanvas.getBoundingClientRect(),b=skyCanvas.getBoundingClientRect();
      renderer.setSize(a.width,a.height,false);gardenRenderer.setSize(b.width,b.height,false);
      const aspect=a.width/a.height, halfW=Math.max(4.1,3.1*aspect);camera.left=-halfW;camera.right=halfW;camera.top=halfW/aspect;camera.bottom=-halfW/aspect;camera.updateProjectionMatrix();
      crewCamera.left=camera.left;crewCamera.right=camera.right;crewCamera.top=camera.top;crewCamera.bottom=camera.bottom;crewCamera.updateProjectionMatrix();
      gardenCamera.aspect=b.width/b.height;gardenCamera.updateProjectionMatrix();dirty=true;
    };
    renderScenes = (state, motionTime = 0, worldChanged = true) => {
      camera.position.set(0,Math.sin(tilt)*10,Math.cos(tilt)*10);camera.lookAt(-.25,0,0);
      spinningEarth.rotation.y = -130*Math.PI/180+angle;
      otherMarker.visible=otherPlaceVisible;
      childShirt.material.color.set(observerIndex?'#36bfa0':'#ec5c84');
      const daylightAmount=state.daylight;
      const warmth=Math.max(0,1-Math.abs(state.elevation)/.45)*.7;
      const skyColor=nightColor.clone().lerp(dayColor,daylightAmount).lerp(twilightColor,warmth);
      garden.background=skyColor;garden.fog=new T.Fog(skyColor,22,75);
      ambient.intensity=.16+daylightAmount*.5;daylight.intensity=Math.max(0,state.elevation)*.75;
      daylight.position.set(Math.sin(state.angle)*9,Math.max(.2,state.elevation*12),-12);
      skySun.position.set(Math.sin(state.angle)*8,1.3+state.elevation*7,-15);skySun.visible=state.elevation>-.16;
      starMaterial.opacity=Math.pow(1-daylightAmount,3)*(1-warmth);cloudMaterial.opacity=daylightAmount*.8;
      windowMaterial.color.set(daylightAmount>.5?'#9cc2cd':'#ffe6a0');
      renderer.render(scene,camera);
      const width=spaceCanvas.clientWidth,height=spaceCanvas.clientHeight;
      const worldHeight=crewCamera.top-crewCamera.bottom;
      astronauts.forEach((member,index) => {
        const compactLesson=document.body.dataset.lessonActive==='true'&&width<600;
        const pixels=Math.min(142,height*(compactLesson?.20:.25));
        const bob=Math.sin(motionTime*.65+index*2.1)*4;
        const x=width*(compactLesson&&index===0?.16:member.u), y=height*(compactLesson&&index===0?.27:member.v)+bob;
        member.holder.scale.setScalar(pixels/height*worldHeight/member.size.y);
        member.holder.position.set(crewCamera.left+x/width*(crewCamera.right-crewCamera.left),crewCamera.top-y/height*worldHeight,0);
        member.holder.rotation.z=(index===0?-.13:.16)+Math.sin(motionTime*.4+index)*.035;
        window.TrioAstronauts.animate(member.model,motionTime,false);
        placeCrewLabel(member,x-pixels*.48,y+pixels*.12);
      });
      renderer.autoClear=false;renderer.clearDepth();renderer.render(crewScene,crewCamera);renderer.autoClear=true;
      if(worldChanged) gardenRenderer.render(garden,gardenCamera);
      pinhead.getWorldPosition(position);position.project(camera);
      const behind=Math.sin(angle)<-.12;
      placeLabel((position.x*.5+.5)*spaceCanvas.clientWidth,(-position.y*.5+.5)*spaceCanvas.clientHeight,behind);
      if(otherPlaceVisible){otherPin.getWorldPosition(position);position.project(camera);placeOtherLabel((position.x*.5+.5)*spaceCanvas.clientWidth,(-position.y*.5+.5)*spaceCanvas.clientHeight,Math.sin(angle)> .12);}
    };
    for (const canvas of [spaceCanvas,skyCanvas]) canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();setPlaying(false);stopAudio();fallbackAfterContextLoss();},{once:true});
    document.body.dataset.renderer='webgl';
  }

  let fallbackActive=false;
  function fallbackAfterContextLoss(){if(fallbackActive)return;fallbackActive=true;for(const [id,canvas] of [['spaceCanvas',spaceCanvas],['skyCanvas',skyCanvas]]){const fresh=canvas.cloneNode(false);canvas.replaceWith(fresh);if(id==='spaceCanvas')spaceCanvas=fresh;else skyCanvas=fresh;}setup2D();bindCanvas();resizeScenes();dirty=true;}
  function placeLabel(x,y,behind){const label=$('personLabel');label.style.left=`${Math.max(85,Math.min(spaceCanvas.clientWidth-85,x))}px`;label.style.top=`${Math.max(100,Math.min(spaceCanvas.clientHeight-45,y))}px`;label.dataset.behind=String(behind);label.textContent=behind?'Nosso lugar · atrás':'Nosso lugar';}
  function placeOtherLabel(x,y,behind){const label=$('otherPlaceLabel');label.style.left=`${Math.max(70,Math.min(spaceCanvas.clientWidth-70,x))}px`;label.style.top=`${Math.max(90,Math.min(spaceCanvas.clientHeight-45,y))}px`;label.textContent=behind?'Outro lugar · atrás':'Outro lugar';}
  function placeCrewLabel(member,x,y){const label=$(`${member.variant}AstronautName`);label.style.left=`${Math.max(24,x)}px`;label.style.top=`${y}px`;}
  function setup2D(){
    document.body.dataset.renderer='2d';$('renderNotice').hidden=false;
    fallbackCrew.forEach(member=>{if(!member.image.src)member.image.src=`astronaut-${member.variant}.png`;});
    const c=spaceCanvas.getContext('2d'),g=skyCanvas.getContext('2d');
    resizeScenes=()=>{for(const canvas of [spaceCanvas,skyCanvas]){const b=canvas.getBoundingClientRect();canvas.width=Math.round(b.width*Math.min(devicePixelRatio,1.5));canvas.height=Math.round(b.height*Math.min(devicePixelRatio,1.5));}dirty=true;};
    function circle(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,M.TAU);ctx.fill();}
    renderScenes=(state,motionTime=0)=>{
      const w=spaceCanvas.width,h=spaceCanvas.height,r=Math.min(w*.25,h*.31),cx=w*.61,cy=h*.5;
      c.fillStyle='#101c39';c.fillRect(0,0,w,h);for(const s of stars)circle(c,s.x*w,s.y*h,s.r,'#a6b5d5');
      circle(c,w*.14,cy,r*.25,'#ffd364');
      c.strokeStyle='#ffe1a0';c.lineWidth=2;for(const dy of [-.35,0,.35]){c.beginPath();c.moveTo(w*.24,cy+dy*r);c.lineTo(cx-r*1.13,cy+dy*r);c.stroke();}
      c.save();c.beginPath();c.arc(cx,cy,r,0,M.TAU);c.clip();
      for(let x=-r;x<r;x+=2){const longitude=Math.asin(x/r),u=M.normalize(longitude-angle+Math.PI*.72)/M.TAU;const sh=Math.sqrt(1-x*x/(r*r));c.drawImage(mapCanvas,u*1535,0,2,768,cx+x,cy-r*sh,2.5,2*r*sh);}
      const shade=c.createLinearGradient(cx-r,0,cx+r,0);shade.addColorStop(0,'#06132c00');shade.addColorStop(.45,'#06132c22');shade.addColorStop(.55,'#06132cbb');shade.addColorStop(1,'#06132cdd');c.fillStyle=shade;c.fillRect(cx-r,cy-r,2*r,2*r);c.restore();
      const px=cx-Math.cos(angle)*r,py=cy-Math.sin(angle)*r*.15;circle(c,px,py,r*.045,'#fff');circle(c,px,py,r*.03,'#ec5c84');placeLabel(px/w*spaceCanvas.clientWidth,py/h*spaceCanvas.clientHeight,Math.sin(angle)<-.12);
      if(otherPlaceVisible){const ox=cx+Math.cos(angle)*r,oy=cy+Math.sin(angle)*r*.15;c.fillStyle='#36bfa0';c.beginPath();c.moveTo(ox,oy-r*.06);c.lineTo(ox+r*.06,oy);c.lineTo(ox,oy+r*.06);c.lineTo(ox-r*.06,oy);c.closePath();c.fill();placeOtherLabel(ox/w*spaceCanvas.clientWidth,oy/h*spaceCanvas.clientHeight,Math.sin(angle)>.12);}
      fallbackCrew.forEach((member,index)=>{const compact=document.body.dataset.lessonActive==='true'&&spaceCanvas.clientWidth<600,size=Math.min(142,spaceCanvas.clientHeight*(compact?.20:.25)),scale=w/spaceCanvas.clientWidth,x=w*(compact&&index===0?.16:member.u),y=h*(compact&&index===0?.27:member.v)+Math.sin(motionTime*.65+index*2.1)*4*scale;if(member.image.complete&&member.image.naturalWidth){c.save();c.translate(x,y);c.rotate(index===0?.13:-.16);c.drawImage(member.image,-size*scale*.4,-size*scale*.5,size*scale*.8,size*scale);c.restore();}placeCrewLabel(member,x/scale-size*.48,y/scale+size*.12);});
      const sw=skyCanvas.width,sh=skyCanvas.height,d=state.daylight,blend=(a,b)=>`rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*d)).join(',')})`;
      const sky=g.createLinearGradient(0,0,0,sh);sky.addColorStop(0,blend([16,29,67],[139,217,238]));sky.addColorStop(1,blend([51,52,85],[225,239,191]));g.fillStyle=sky;g.fillRect(0,0,sw,sh);
      if(d<.5)for(const s of stars.slice(0,60))circle(g,s.x*sw,s.y*sh*.7,1.4,'#e6edff');
      if(state.elevation>-.1)circle(g,sw*(.5+Math.sin(state.angle)*.4),sh*(.67-state.elevation*.4),sh*.055,'#ffe8a1');
      g.fillStyle=blend([25,52,51],[105,162,80]);g.beginPath();g.moveTo(0,sh*.74);g.quadraticCurveTo(sw*.3,sh*.54,sw,sh*.78);g.lineTo(sw,sh);g.lineTo(0,sh);g.fill();
      g.fillStyle=blend([36,65,58],[133,184,91]);g.fillRect(0,sh*.82,sw,sh*.18);
      g.fillStyle=blend([80,66,63],[243,221,174]);g.fillRect(sw*.67,sh*.64,sw*.19,sh*.2);
      g.fillStyle=blend([77,49,55],[205,118,84]);g.beginPath();g.moveTo(sw*.64,sh*.64);g.lineTo(sw*.765,sh*.53);g.lineTo(sw*.89,sh*.64);g.fill();
      g.fillStyle=d<.5?'#ffe5a3':'#83b7bd';g.fillRect(sw*.7,sh*.68,sw*.04,sh*.05);g.fillRect(sw*.79,sh*.68,sw*.04,sh*.05);
      for(const x of [.13,.93]){g.fillStyle='#66543b';g.fillRect(sw*x,sh*.65,sw*.018,sh*.2);circle(g,sw*(x+.01),sh*.64,sh*.085,blend([29,67,55],[68,139,78]));}
      g.fillStyle=observerIndex?'#36bfa0':'#e35d83';g.fillRect(sw*.32,sh*.79,sw*.045,sh*.09);circle(g,sw*.342,sh*.76,sh*.028,'#c58b60');g.fillStyle='#384e77';g.fillRect(sw*.324,sh*.88,sw*.013,sh*.06);g.fillRect(sw*.35,sh*.88,sw*.013,sh*.06);
    };
  }
  function bindCanvas(){
    let drag=null;
    spaceCanvas.addEventListener('pointerdown',event=>{if(lessonLocked||event.isPrimary===false)return;manual();drag={id:event.pointerId,x:event.clientX,y:event.clientY};spaceCanvas.setPointerCapture(event.pointerId);});
    spaceCanvas.addEventListener('pointermove',event=>{if(lessonLocked||!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.x=event.clientX;drag.y=event.clientY;tilt=Math.max(-.65,Math.min(.9,tilt+dy*.003));setAngle(angle+dx/spaceCanvas.clientWidth*M.TAU,true);});
    const end=()=>{drag=null;};spaceCanvas.addEventListener('pointerup',end);spaceCanvas.addEventListener('pointercancel',end);spaceCanvas.addEventListener('lostpointercapture',end);
    spaceCanvas.addEventListener('keydown',event=>{if(lessonLocked)return;if(['ArrowLeft','ArrowRight','Home'].includes(event.key)){event.preventDefault();manual();setAngle(event.key==='Home'?0:angle+(event.key==='ArrowRight'?1:-1)*Math.PI/36,true);}});
  }
  try { setup3D(); } catch (error) {
    for (const [id,canvas] of [['spaceCanvas',spaceCanvas],['skyCanvas',skyCanvas]]){const fresh=canvas.cloneNode(false);canvas.replaceWith(fresh);if(id==='spaceCanvas')spaceCanvas=fresh;else skyCanvas=fresh;}
    setup2D();
  }
  bindCanvas();
  new ResizeObserver(()=>resizeScenes()).observe(document.querySelector('.experience'));
  new IntersectionObserver(entries=>{spaceVisible=entries[0].isIntersecting;if(spaceVisible)dirty=true;}).observe($('spaceView'));
  window.addEventListener('resize',()=>resizeScenes());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){setPlaying(false);tween=null;stopAudio();}lastFrame=0;dirty=true;});
  window.addEventListener('pagehide',()=>{setPlaying(false);stopAudio();});
  resizeScenes();updateUI();
  lesson = window.DayNightLesson.create({
    getAngle: () => angle,
    setAngle(value) { manual(); setAngle(value); },
    setObserver(index) { observerIndex = index === 1 ? 1 : 0; dirty = true; updateUI(); },
    showOtherPlace(visible) { otherPlaceVisible = Boolean(visible); $('otherPlaceLabel').hidden = !otherPlaceVisible; dirty = true; },
    setLock(locked) {
      lessonLocked = Boolean(locked); range.disabled = lessonLocked;
      $('rotationLabel').textContent = lessonLocked ? 'Posição da Terra' : 'Gire com o dedo';
      spaceCanvas.setAttribute('aria-disabled', String(lessonLocked));
      $('dragHint').hidden = lessonLocked;
    },
    setGuided(active) {
      if (active && document.body.dataset.lessonActive !== 'true') wasCrewMoving = crewMoving;
      document.body.dataset.lessonActive = String(active);
      crewMoving = active ? false : wasCrewMoving; updateCrewControl();
      $('startLesson').setAttribute('aria-pressed', String(active));
      $('freeExplore').setAttribute('aria-pressed', String(!active));
      $('instruction').textContent = active ? 'Acompanhe o lugar marcado nas duas vistas.' : 'Gire a Terra. O que muda no céu?';
      challenge = false; turnProgress = 0; dirty = true;
    },
    pause() { setPlaying(false); tween = null; stopAudio(); },
    turnToNight() {
      manual(); setAngle(0);
      if (reducedMotion) setAngle(Math.PI);
      else tween = { start: 0, distance: Math.PI, elapsed: 0, duration: 3.5 };
    },
  });
  $('freeExplore').onclick = () => lesson.exit();
  lesson.start();
  function frame(time){
    const dt=lastFrame?Math.min((time-lastFrame)/1000,.06):0;lastFrame=time;
    if(!document.hidden){
      if(crewMoving&&spaceVisible)crewTime+=dt;
      if(tween){tween.elapsed+=dt;const p=Math.min(1,tween.elapsed/tween.duration),ease=1-Math.pow(1-p,3);setAngle(tween.start+tween.distance*ease);if(p===1){tween=null;updateUI();}}
      if(playing)setAngle(angle+dt*M.TAU/36);
      if(dirty||(crewMoving&&spaceVisible&&time-lastCrewFrame>=33)){renderScenes(observedState(),crewTime,dirty);dirty=false;lastCrewFrame=time;}
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
