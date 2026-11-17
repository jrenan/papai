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
  let angle = 0, playing = false, tween = null, challenge = false;
  let phase = '', lastFrame = 0, dirty = true, renderScenes, resizeScenes;
  let turnProgress = 0, tilt = 0.28;
  let lesson = null, lessonLocked = false, observerIndex = 0, otherPlaceVisible = false;
  let wasCrewMoving = false, spin = 0, cheerClock = 0, crewModels = [], crewHits = [];
  let slowFrames = 0, lowerQuality = null;
  const observedState = () => M.getState(angle + (observerIndex ? Math.PI : 0));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const crew = [{ name: 'Leo', variant: 'blue', u: .27, v: .265 }, { name: 'Rafa', variant: 'red', u: .27, v: .775 }];
  const crewPixels = (height, compact) => Math.min(196, height * (compact ? .3 : .33));
  let crewMoving = !reducedMotion, crewTime = 0, lastCrewFrame = 0, spaceVisible = true;
  function updateCrewControl() {
    const button = $('crewMotion');
    const label = `${crewMoving ? 'Pausar' : 'Retomar'} movimentos do cenário`;
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
  let fallbackGlobe = null;
  const stars = Array.from({ length: 100 }, (_, i) => ({ x: fract(Math.sin(i * 97.37 + 1) * 4258), y: fract(Math.sin(i * 43.21 + 3) * 8347), r: i % 7 === 0 ? 1.6 : 0.8 }));
  function fract(x) { return x - Math.floor(x); }
  function paintMap(geo) {
    const sea = mapContext.createLinearGradient(0, 0, 0, 768);
    sea.addColorStop(0, '#2b7fc6'); sea.addColorStop(.5, '#35a3dc'); sea.addColorStop(1, '#2b7fc6');
    mapContext.fillStyle = sea; mapContext.fillRect(0, 0, 1536, 768);
    mapContext.strokeStyle = '#6cc0e633'; mapContext.lineWidth = 1;
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
      mapContext.fillStyle = '#6cc66a'; mapContext.fill('evenodd');
      mapContext.strokeStyle = '#b6e795'; mapContext.lineWidth = 1.4; mapContext.stroke();
    }
    for (const [from, to] of [[0, 34], [768, 716]]) { // soft polar ice
      const ice = mapContext.createLinearGradient(0, from, 0, to);
      ice.addColorStop(0, '#f6fcff'); ice.addColorStop(.55, '#f6fcffee'); ice.addColorStop(1, '#f6fcff00');
      mapContext.fillStyle = ice; mapContext.fillRect(0, Math.min(from, to), 1536, Math.abs(to - from));
    }
    fallbackGlobe?.refresh();
  }
  paintMap();
  let earthTexture;
  fetch('../data/countries-lite.geojson').then(r => { if (!r.ok) throw new Error('map'); return r.json(); }).then(geo => { paintMap(geo); if (earthTexture) earthTexture.needsUpdate = true; dirty = true; }).catch(() => {});
  const voice = window.DayNightVoice.create(state => {
    const speaking = state.status === 'playing' || (state.status === 'loading' && state.enabled);
    $('listenButton').hidden = !state.available && state.status !== 'error';
    $('listenButton').dataset.playing = String(speaking);
    $('listenButton').setAttribute('aria-pressed', String(state.enabled));
    $('listenButton').querySelector('span').textContent = speaking ? 'Pausar voz' : state.enabled ? 'Ouvir de novo' : 'Ouvir';
    $('voicePrompt').hidden = state.status === 'unavailable' || (state.available && state.enabled && state.status !== 'error');
    $('startVoiceButton').disabled = state.status === 'loading' && !state.available;
    $('voicePromptText').textContent = state.error || 'Toque para ouvir. Eu vou te guiar!';
    $('audioStatus').textContent = state.error;
    $('voiceCredit').hidden = !state.available;
  });
  function stopAudio() { voice.stop(); }
  function narrate(id, explicit = false) {
    if (explicit) voice.enable(id);
    else voice.speak(id);
  }
  function currentNarration() { return lesson?.currentNarration() || (challenge ? 'challenge' : phase || 'intro'); }
  $('startVoiceButton').onclick = () => voice.enable(currentNarration());
  function setPlaying(value) {
    playing = value;
    $('playButton').setAttribute('aria-pressed', String(value));
    $('playButton').querySelector('span').textContent = value ? 'Pausar' : 'Girar sozinha';
    $('playButton').querySelector('use').setAttribute('href', value ? '#i-pause' : '#i-play');
  }
  function manual() { setPlaying(false); tween = null; spin = 0; }
  const touched = () => { $('dragHint').dataset.used = 'true'; };
  // A short shared reward: the astronauts cheer and paper stars fall over the stage.
  const party = document.createElement('div'); party.className = 'party'; party.setAttribute('aria-hidden', 'true');
  document.querySelector('.experience').append(party);
  let partyTimer = 0;
  function celebrate() {
    if (reducedMotion || document.hidden) return;
    cheerClock = 2.6;
    crewModels.forEach((model, index) => window.TrioAstronauts.cheer(model, crewTime + index * .16));
    const colors = ['#ffcf63', '#ec5c84', '#3f9cf0', '#36bfa0', '#ff8a5c', '#ffffff'];
    party.replaceChildren(...Array.from({ length: 30 }, (_, i) => {
      const piece = document.createElement('i');
      piece.style.cssText = `left:${4 + fract(Math.sin(i * 12.9) * 43758) * 92}%;background:${colors[i % colors.length]};--fall:${.9 + fract(Math.sin(i * 7.3) * 9631) * .8}s;--wait:${fract(Math.sin(i * 3.1) * 5381) * .35}s;--sway:${Math.round((fract(Math.sin(i * 5.7) * 1237) - .5) * 120)}px;--turn:${Math.round((fract(Math.sin(i * 9.1) * 733) - .5) * 900)}deg`;
      if (i % 3 === 0) piece.className = 'star';
      return piece;
    }));
    clearTimeout(partyTimer); partyTimer = setTimeout(() => party.replaceChildren(), 2300);
  }
  function setAngle(value, fromUser = false) {
    const delta = value - angle;
    angle = value;
    if (fromUser || playing) {
      turnProgress += delta;
      if (Math.abs(turnProgress) >= M.TAU - 0.000001) { turnProgress = 0; if (!challenge) $('challengeStatus').textContent = 'Uma volta inteira! Passaram o dia e a noite.'; narrate('full-turn'); celebrate(); }
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
      $('skyView').dataset.phase = phase; document.body.dataset.phase = phase;
      const card = $('phaseCard'); card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
      skyCanvas.setAttribute('aria-label', `${copy[phase][0]} ${copy[phase][1]}`);
      document.querySelectorAll('[data-phase]').forEach(button => { if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.phase === phase)); });
      if (document.body.dataset.lessonActive === 'false') voice.schedule(phase);
    }
    $('skyView').dataset.observer = observerIndex ? 'other' : 'home';
    $('skyHeading').textContent = observerIndex ? 'O céu no outro lugar' : 'O céu em Taubaté';
    $('localTime').textContent = state.localTime;
    $('clockPlace').textContent = observerIndex ? 'Outro lugar' : 'Taubaté';
    $('localTime').setAttribute('datetime', state.localTime);
    $('placeName').textContent = observerIndex ? 'Outro lugar na Terra' : 'Taubaté, SP';
    $('placeLegend').dataset.observer = observerIndex ? 'other' : 'home';
    $('placeLegendText').textContent = observerIndex ? 'Outro lugar nas duas vistas' : 'Taubaté nas duas vistas';
    if (challenge && state.elevation > 0.55) {
      challenge = false;
      $('challengeStatus').textContent = 'Você descobriu! Nosso lugar recebeu luz. Ficou de dia!';
      $('challengeStatus').dataset.status = 'complete';
      document.querySelector('.discovery').dataset.complete = 'true';
      $('challengeButton').textContent = 'Descobrir de novo';
      setPlaying(false); narrate('day'); celebrate();
    }
    lesson?.update({ ...M.getState(angle), angle, settled: !tween && !spin });
  }
  function goTo(target) {
    manual(); turnProgress = 0;
    const start = angle;
    let distance = M.normalize(target - M.normalize(angle));
    if (distance < 0.01) distance = 0;
    if (reducedMotion) setAngle(start + distance);
    else tween = { start, distance, elapsed: 0, duration: Math.min(1.6, 0.6 + distance * 0.2) };
  }
  $('playButton').onclick = () => { if (lessonLocked) return; tween = null; setPlaying(!playing); if (playing) narrate(phase); };
  $('resetButton').onclick = () => { manual(); challenge = false; turnProgress = 0; tilt = 0.28; $('challengeStatus').textContent = 'A Terra gira. O dia vira noite. E começa outro dia!'; $('challengeStatus').dataset.status = ''; document.querySelector('.discovery').dataset.complete = 'false'; $('challengeButton').textContent = 'Vamos descobrir?'; setAngle(0); };
  range.addEventListener('input', () => {
    if (lessonLocked) return;
    const value = Number(range.value) * M.TAU / 360;
    const delta = M.normalize(value - M.normalize(angle) + Math.PI) - Math.PI;
    manual(); touched(); setAngle(angle + delta, true);
  });
  document.querySelectorAll('button[data-phase]').forEach(button => button.onclick = () => { if (document.body.dataset.lessonActive === 'true') return; goTo(M.targets[button.dataset.phase]); narrate(button.dataset.phase); });
  $('listenButton').onclick = () => { if (voice.isSpeaking()) voice.disable(); else voice.enable(currentNarration()); };
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
    for (const r of [renderer, gardenRenderer]) { r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.outputEncoding = T.sRGBEncoding; }
    const scene = new T.Scene(); scene.background = new T.Color('#101c39');
    const camera = new T.OrthographicCamera(-5, 5, 3.5, -3.5, 0.1, 100);
    const earthRoot = new T.Group(); earthRoot.position.set(.65, -.05, 0); scene.add(earthRoot);
    const spinningEarth = new T.Group(); earthRoot.add(spinningEarth);
    earthTexture = new T.CanvasTexture(mapCanvas); earthTexture.encoding = T.sRGBEncoding;
    earthTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const earth = new T.Mesh(new T.SphereGeometry(1.64, 72, 48), new T.MeshPhongMaterial({ map: earthTexture, shininess: 10, specular: '#23566e' }));
    spinningEarth.add(earth);
    scene.add(new T.AmbientLight('#b4d2ff', .09));
    const sunLight = new T.DirectionalLight('#fff3d2', 1.65); sunLight.position.set(-10, 0, 0); sunLight.target = earthRoot; scene.add(sunLight);
    const axis = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0,-2,0),new T.Vector3(0,2,0)]),new T.LineDashedMaterial({color:'#90a8cd',dashSize:.09,gapSize:.09,transparent:true,opacity:.55}));axis.computeLineDistances();earthRoot.add(axis);
    const cityVector=M.geographicVector(M.location.latitude,M.location.longitude);
    const markerBase = new T.Vector3(cityVector.x,cityVector.y,cityVector.z);
    const marker = new T.Group();marker.position.copy(markerBase.clone().multiplyScalar(1.65));marker.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),markerBase);spinningEarth.add(marker);
    const markerMat = new T.MeshBasicMaterial({color:'#ed5b86'});
    const pin=new T.Mesh(new T.CylinderGeometry(.018,.018,.2,8),new T.MeshBasicMaterial({color:'#fff4df'}));pin.position.y=.1;marker.add(pin);
    const pinhead=new T.Mesh(new T.SphereGeometry(.095,16,12),markerMat);pinhead.position.y=.25;marker.add(pinhead);
    const pinRing=new T.Mesh(new T.TorusGeometry(.13,.018,8,32),new T.MeshBasicMaterial({color:'#ffffff'}));pinRing.rotation.x=Math.PI/2;pinRing.position.y=.02;marker.add(pinRing);
    const oppositeBase=markerBase.clone().negate();
    const otherMarker=marker.clone(true);otherMarker.position.copy(oppositeBase.clone().multiplyScalar(1.65));otherMarker.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),oppositeBase);
    const otherPin=otherMarker.children[1];otherPin.material=new T.MeshBasicMaterial({color:'#36bfa0'});otherPin.geometry=new T.OctahedronGeometry(.11);
    otherMarker.visible=false;spinningEarth.add(otherMarker);
    const spaceArt = window.DayNightScenery.space(T, { scene, earthRoot, spinningEarth, earthRadius: 1.64, sunPosition: new T.Vector3(-2.95, 0, 0), sunLight, pulse: pinRing });

    // A separate foreground scene draws the children; their shading is baked, so the night side stays dark.
    const crewScene = new T.Scene();
    const crewCamera = new T.OrthographicCamera(-5, 5, 3.5, -3.5, .1, 30);
    crewCamera.position.set(0, 0, 8);
    const astronauts = crew.map(member => {
      const model = window.TrioAstronauts.create(T, member);
      const bounds = new T.Box3().setFromObject(model);
      const size = bounds.getSize(new T.Vector3());
      model.position.sub(bounds.getCenter(new T.Vector3()));
      const holder = new T.Group(); holder.add(model); crewScene.add(holder);
      return { ...member, model, holder, size };
    });
    crewModels = astronauts.map(member => member.model);

    const garden = new T.Scene();
    const gardenCamera=new T.PerspectiveCamera(47,1,.1,500);gardenCamera.position.set(0,2.6,8);gardenCamera.lookAt(0,2,-5);
    const gardenArt = window.DayNightScenery.garden(T, { scene: garden, camera: gardenCamera, renderer: gardenRenderer });
    // The Sun is a distant sky object. The horizon clips its disk continuously;
    // trees, the house and hills also occlude it through ordinary depth testing.
    gardenRenderer.localClippingEnabled=true;
    const solarHorizon=new T.Plane(new T.Vector3(0,1,0),-gardenCamera.position.y);
    const skySun=new T.Mesh(new T.SphereGeometry(8,48,32),new T.MeshBasicMaterial({color:'#ffed9b',fog:false,clippingPlanes:[solarHorizon]}));
    skySun.name='distant-sun';garden.add(skySun);
    let gardenTick=0;
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
      spinningEarth.rotation.y = M.earthRotation(angle);
      otherMarker.visible=otherPlaceVisible;
      const skyHalfWidth=208*Math.tan(gardenCamera.fov*Math.PI/360)*gardenCamera.aspect;
      skySun.position.set(Math.sin(state.angle)*skyHalfWidth*.88,gardenCamera.position.y+state.elevation*70,-200);
      spaceArt.update(motionTime);
      gardenArt.update(state,motionTime,observerIndex,skySun.position,worldChanged);
      pinhead.getWorldPosition(position);position.project(camera);
      const pinX=(position.x*.5+.5)*spaceCanvas.clientWidth,pinY=(-position.y*.5+.5)*spaceCanvas.clientHeight;
      renderer.render(scene,camera);
      const width=spaceCanvas.clientWidth,height=spaceCanvas.clientHeight;
      const worldHeight=crewCamera.top-crewCamera.bottom;
      astronauts.forEach((member,index) => {
        const compactLesson=document.body.dataset.lessonActive==='true'&&width<600;
        const pixels=crewPixels(height,compactLesson);
        const bob=Math.sin(motionTime*.65+index*2.1)*4;
        const x=width*(compactLesson&&index===0?.16:member.u), y=height*(compactLesson&&index===0?.27:member.v)+bob;
        member.holder.scale.setScalar(pixels/height*worldHeight/member.size.y);
        member.holder.position.set(crewCamera.left+x/width*(crewCamera.right-crewCamera.left),crewCamera.top-y/height*worldHeight,0);
        member.holder.rotation.z=(index===0?-.13:.16)+Math.sin(motionTime*.4+index)*.035;
        const gaze=Math.hypot(pinX-x,pinY-y)||1;window.TrioAstronauts.lookAt(member.model,(pinX-x)/gaze,(y-pinY)/gaze*.7);
        window.TrioAstronauts.animate(member.model,motionTime,!crewMoving&&cheerClock<=0);
        crewHits[index]={x,y,r:pixels*.46,model:member.model};
        placeCrewLabel(member,x-pixels*.5,y+pixels*.2);
      });
      renderer.autoClear=false;renderer.clearDepth();renderer.render(crewScene,crewCamera);renderer.autoClear=true;
      if(worldChanged||gardenTick++%2===0) gardenRenderer.render(garden,gardenCamera);
      placeLabel(pinX,pinY,Math.sin(angle)<-.12);
      if(otherPlaceVisible){otherPin.getWorldPosition(position);position.project(camera);placeOtherLabel((position.x*.5+.5)*spaceCanvas.clientWidth,(-position.y*.5+.5)*spaceCanvas.clientHeight,Math.sin(angle)> .12);}
    };
    for (const canvas of [spaceCanvas,skyCanvas]) canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();setPlaying(false);stopAudio();fallbackAfterContextLoss();},{once:true});
    // If frames stay slow, step down: first sharper pixels and shadows go, then the rest of the extra resolution.
    let quality=0;
    lowerQuality=()=>{if(quality>=2)return;quality++;const ratio=quality===1?Math.min(devicePixelRatio,1.25):1;renderer.setPixelRatio(ratio);gardenRenderer.setPixelRatio(ratio);gardenArt.setShadows(false);resizeScenes();};
    document.body.dataset.renderer='webgl';
  }

  let fallbackActive=false;
  function fallbackAfterContextLoss(){if(fallbackActive)return;fallbackActive=true;lowerQuality=null;crewModels=[];crewHits=[];for(const [id,canvas] of [['spaceCanvas',spaceCanvas],['skyCanvas',skyCanvas]]){const fresh=canvas.cloneNode(false);canvas.replaceWith(fresh);if(id==='spaceCanvas')spaceCanvas=fresh;else skyCanvas=fresh;}setup2D();bindCanvas();resizeScenes();dirty=true;}
  function placeLabel(x,y,behind){const label=$('personLabel');label.style.left=`${Math.max(85,Math.min(spaceCanvas.clientWidth-85,x))}px`;label.style.top=`${Math.max(100,Math.min(spaceCanvas.clientHeight-45,y))}px`;label.dataset.behind=String(behind);label.textContent=behind?'Taubaté · atrás':'Taubaté';}
  function placeOtherLabel(x,y,behind){const label=$('otherPlaceLabel');label.style.left=`${Math.max(70,Math.min(spaceCanvas.clientWidth-70,x))}px`;label.style.top=`${Math.max(90,Math.min(spaceCanvas.clientHeight-45,y))}px`;label.textContent=behind?'Outro lugar · atrás':'Outro lugar';}
  function placeCrewLabel(member,x,y){const label=$(`${member.variant}AstronautName`);label.style.left=`${Math.max(24,x)}px`;label.style.top=`${y}px`;}
  function setup2D(){
    document.body.dataset.renderer='2d';$('renderNotice').hidden=false;
    fallbackCrew.forEach(member=>{if(!member.image.src)member.image.src=`astronaut-${member.variant}.png`;});
    const c=spaceCanvas.getContext('2d'),g=skyCanvas.getContext('2d');
    fallbackGlobe=window.DayNightGlobeMap.create(mapCanvas);
    resizeScenes=()=>{for(const canvas of [spaceCanvas,skyCanvas]){const b=canvas.getBoundingClientRect();canvas.width=Math.round(b.width*Math.min(devicePixelRatio,1.5));canvas.height=Math.round(b.height*Math.min(devicePixelRatio,1.5));}dirty=true;};
    function circle(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,M.TAU);ctx.fill();}
    renderScenes=(state,motionTime=0)=>{
      const w=spaceCanvas.width,h=spaceCanvas.height,r=Math.min(w*.25,h*.31),cx=w*.61,cy=h*.5;
      c.fillStyle='#101c39';c.fillRect(0,0,w,h);for(const s of stars)circle(c,s.x*w,s.y*h,s.r,'#a6b5d5');
      circle(c,w*.14,cy,r*.25,'#ffd364');
      c.strokeStyle='#ffe1a0';c.lineWidth=2;for(const dy of [-.35,0,.35]){c.beginPath();c.moveTo(w*.24,cy+dy*r);c.lineTo(cx-r*1.13,cy+dy*r);c.stroke();}
      c.save();c.beginPath();c.arc(cx,cy,r,0,M.TAU);c.clip();
      fallbackGlobe.paint(c,{cx,cy,r,rotation:M.earthRotation(angle)});
      const shade=c.createLinearGradient(cx-r,0,cx+r,0);shade.addColorStop(0,'#06132c00');shade.addColorStop(.45,'#06132c22');shade.addColorStop(.55,'#06132cbb');shade.addColorStop(1,'#06132cdd');c.fillStyle=shade;c.fillRect(cx-r,cy-r,2*r,2*r);c.restore();
      const city=M.geographicVector(M.location.latitude,M.location.longitude),rotation=M.earthRotation(angle);
      const cityX=city.x*Math.cos(rotation)+city.z*Math.sin(rotation),cityZ=-city.x*Math.sin(rotation)+city.z*Math.cos(rotation);
      const px=cx+cityX*r,py=cy-city.y*r;circle(c,px,py,r*.045,'#fff');circle(c,px,py,r*.03,'#ec5c84');placeLabel(px/w*spaceCanvas.clientWidth,py/h*spaceCanvas.clientHeight,cityZ<-.12);
      if(otherPlaceVisible){const ox=cx-cityX*r,oy=cy+city.y*r;c.fillStyle='#36bfa0';c.beginPath();c.moveTo(ox,oy-r*.06);c.lineTo(ox+r*.06,oy);c.lineTo(ox,oy+r*.06);c.lineTo(ox-r*.06,oy);c.closePath();c.fill();placeOtherLabel(ox/w*spaceCanvas.clientWidth,oy/h*spaceCanvas.clientHeight,cityZ>.12);}

      fallbackCrew.forEach((member,index)=>{const compact=document.body.dataset.lessonActive==='true'&&spaceCanvas.clientWidth<600,size=crewPixels(spaceCanvas.clientHeight,compact),scale=w/spaceCanvas.clientWidth,x=w*(compact&&index===0?.16:member.u),y=h*(compact&&index===0?.27:member.v)+Math.sin(motionTime*.65+index*2.1)*4*scale;if(member.image.complete&&member.image.naturalWidth){c.save();c.translate(x,y);c.rotate(index===0?.13:-.16);c.drawImage(member.image,-size*scale*.4,-size*scale*.5,size*scale*.8,size*scale);c.restore();}placeCrewLabel(member,x/scale-size*.5,y/scale+size*.2);});
      const sw=skyCanvas.width,sh=skyCanvas.height,d=state.daylight,blend=(a,b)=>`rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*d)).join(',')})`;
      const warmth=Math.max(0,1-Math.abs(state.elevation)/.45)*.7;
      const skyTint=(a,b)=>`rgb(${a.map((v,i)=>Math.round((v+(b[i]-v)*d)*(1-warmth)+[242,174,131][i]*warmth)).join(',')})`;
      const sky=g.createLinearGradient(0,0,0,sh);sky.addColorStop(0,skyTint([16,29,67],[139,217,238]));sky.addColorStop(1,skyTint([51,52,85],[225,239,191]));g.fillStyle=sky;g.fillRect(0,0,sw,sh);
      g.save();g.globalAlpha=Math.pow(1-d,3)*(1-warmth);for(const s of stars.slice(0,60))circle(g,s.x*sw,s.y*sh*.7,1.4,'#e6edff');g.restore();
      const horizon=sh*.7;
      g.save();g.beginPath();g.rect(0,0,sw,horizon);g.clip();
      circle(g,sw*(.5+Math.sin(state.angle)*.44),horizon-state.elevation*sh*.52,sh*.045,'#ffe8a1');
      g.restore();
      g.fillStyle=blend([25,52,51],[105,162,80]);g.fillRect(0,horizon,sw,sh-horizon);
      g.fillStyle=blend([25,52,51],[105,162,80]);g.beginPath();g.moveTo(0,sh*.74);g.quadraticCurveTo(sw*.3,sh*.54,sw,sh*.78);g.lineTo(sw,sh);g.lineTo(0,sh);g.fill();
      g.fillStyle=blend([36,65,58],[133,184,91]);g.fillRect(0,sh*.82,sw,sh*.18);
      g.fillStyle=blend([80,66,63],[243,221,174]);g.fillRect(sw*.67,sh*.64,sw*.19,sh*.2);
      g.fillStyle=blend([77,49,55],[205,118,84]);g.beginPath();g.moveTo(sw*.64,sh*.64);g.lineTo(sw*.765,sh*.53);g.lineTo(sw*.89,sh*.64);g.fill();
      g.fillStyle=d<.5?'#ffe5a3':'#83b7bd';g.fillRect(sw*.7,sh*.68,sw*.04,sh*.05);g.fillRect(sw*.79,sh*.68,sw*.04,sh*.05);
      for(const x of [.18,.50]){g.fillStyle='#66543b';g.fillRect(sw*x,sh*.65,sw*.018,sh*.2);circle(g,sw*(x+.01),sh*.64,sh*.085,blend([29,67,55],[68,139,78]));}
      g.fillStyle=observerIndex?'#36bfa0':'#e35d83';g.fillRect(sw*.32,sh*.79,sw*.045,sh*.09);circle(g,sw*.342,sh*.76,sh*.028,'#c58b60');g.fillStyle='#384e77';g.fillRect(sw*.324,sh*.88,sw*.013,sh*.06);g.fillRect(sw*.35,sh*.88,sw*.013,sh*.06);
    };
  }
  function bindCanvas(){
    let drag=null,press=null;
    spaceCanvas.addEventListener('pointerdown',event=>{if(event.isPrimary===false)return;press={x:event.clientX,y:event.clientY};if(lessonLocked)return;manual();touched();drag={id:event.pointerId,x:event.clientX,y:event.clientY,speed:0,at:performance.now()};spaceCanvas.setPointerCapture(event.pointerId);});
    spaceCanvas.addEventListener('pointermove',event=>{if(lessonLocked||!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y,now=performance.now(),turn=dx/spaceCanvas.clientWidth*M.TAU;drag.speed=drag.speed*.4+turn/Math.max(.008,(now-drag.at)/1000)*.6;drag.at=now;drag.x=event.clientX;drag.y=event.clientY;tilt=Math.max(-.65,Math.min(.9,tilt+dy*.003));setAngle(angle+turn,true);});
    // Letting go mid-swipe keeps the Earth turning for a moment, like a real globe.
    const end=()=>{if(drag&&!reducedMotion&&!lessonLocked&&performance.now()-drag.at<120&&Math.abs(drag.speed)>.7)spin=Math.max(-6,Math.min(6,drag.speed));drag=null;};spaceCanvas.addEventListener('pointerup',end);spaceCanvas.addEventListener('pointercancel',end);spaceCanvas.addEventListener('lostpointercapture',end);
    // Tapping Leo or Rafa makes that astronaut cheer.
    spaceCanvas.addEventListener('click',event=>{if(reducedMotion||!press||Math.hypot(event.clientX-press.x,event.clientY-press.y)>8)return;const box=spaceCanvas.getBoundingClientRect(),x=event.clientX-box.left,y=event.clientY-box.top;const hit=crewHits.find(target=>target&&Math.hypot(x-target.x,y-target.y)<target.r);if(hit){window.TrioAstronauts.cheer(hit.model,crewTime);cheerClock=Math.max(cheerClock,2.6);}});
    spaceCanvas.addEventListener('keydown',event=>{if(lessonLocked)return;if(['ArrowLeft','ArrowRight','Home'].includes(event.key)){event.preventDefault();manual();touched();setAngle(event.key==='Home'?0:angle+(event.key==='ArrowRight'?1:-1)*Math.PI/36,true);}});
  }
  try { setup3D(); } catch (error) {
    for (const [id,canvas] of [['spaceCanvas',spaceCanvas],['skyCanvas',skyCanvas]]){const fresh=canvas.cloneNode(false);canvas.replaceWith(fresh);if(id==='spaceCanvas')spaceCanvas=fresh;else skyCanvas=fresh;}
    setup2D();
  }
  bindCanvas();
  const sceneResizeObserver=new ResizeObserver(()=>resizeScenes());
  sceneResizeObserver.observe(document.querySelector('.experience'));
  sceneResizeObserver.observe(document.querySelector('.sky-scene'));
  new IntersectionObserver(entries=>{spaceVisible=entries[0].isIntersecting;if(spaceVisible)dirty=true;}).observe($('spaceView'));
  window.addEventListener('resize',()=>resizeScenes());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){setPlaying(false);tween=null;stopAudio();}lastFrame=0;dirty=true;});
  window.addEventListener('pagehide',()=>{setPlaying(false);stopAudio();});
  resizeScenes();updateUI();
  lesson = window.DayNightLesson.create({
    getAngle: () => angle,
    speak(id) { voice.speak(id); },
    stopSpeech() { voice.stop(); },
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
    pause() { setPlaying(false); tween = null; spin = 0; stopAudio(); },
    celebrate,
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
      const lively=(crewMoving||cheerClock>0)&&spaceVisible;
      if(lively)crewTime+=dt;
      if(lively&&dt>0&&lowerQuality&&!reducedMotion){slowFrames=dt>.034?slowFrames+1:Math.max(0,slowFrames-2);if(slowFrames>50){slowFrames=0;lowerQuality();}}
      if(cheerClock>0){cheerClock=Math.max(0,cheerClock-dt);if(!cheerClock)dirty=true;}
      if(tween){tween.elapsed+=dt;const p=Math.min(1,tween.elapsed/tween.duration),ease=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;setAngle(tween.start+tween.distance*ease);if(p===1){tween=null;updateUI();}}
      if(spin){setAngle(angle+spin*dt,true);spin*=Math.exp(-dt*2.4);if(Math.abs(spin)<.04){spin=0;updateUI();}}
      if(playing&&!voice.isSpeaking())setAngle(angle+dt*M.TAU/36);
      if(dirty||lively){renderScenes(observedState(),crewTime,dirty);dirty=false;lastCrewFrame=time;}
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
