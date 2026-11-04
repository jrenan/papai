// Shared by both games. A round measures the first answer and use of counting help.
(() => {
  'use strict';
  const stages = [
    'Juntar até 5', 'Contar até 10', 'Passar do 10',
    'Descobrir a dezena', 'Somar até 50', 'Trocar dez unidades',
  ];
  const independent = attempt => attempt.mistakes === 0 && !attempt.assisted;
  const fact = (a, b) => [Math.min(a, b), Math.max(a, b)].join('+');
  function evidence(attempts, level) {
    const recent = attempts.filter(attempt => attempt.level === level).slice(-5);
    const successes = recent.filter(independent);
    return {
      recent, successes: successes.length,
      mastered: successes.length >= 4 && new Set(successes.map(p => fact(p.a, p.b))).size >= 3,
    };
  }
  function stageOf(attempts) {
    const index = stages.findIndex((_, i) => !evidence(attempts, i).mastered);
    return index < 0 ? stages.length - 1 : index;
  }
  function levelOf(game, a, b) {
    if (game === 'friends') return a + b <= 5 ? 0 : a + b <= 10 ? 1 : 2;
    if (a + b <= 20) return 3;
    return a + b <= 50 && a % 10 + b % 10 < 10 ? 4 : 5;
  }
  // Build legal facts once so a retry or a review can never draw an impossible question.
  const pools = stages.map(() => []);
  for (let a = 1; a <= 10; a++) {
    for (let b = 1; b <= 10; b++) pools[levelOf('friends', a, b)].push([a, b]);
  }
  for (let a = 2; a <= 69; a++) {
    for (let b = 2; b <= 39 && a + b <= 100; b++) {
      const level = levelOf('blocks', a, b);
      if (level === 3 && (a < 10 || b > 9)) continue;
      if (level === 4 && a < 10) continue;
      if (level === 5 && (a < 10 || a % 10 + b % 10 < 10)) continue;
      pools[level].push([a, b]);
    }
  }
  function choose(attempts, game, rounds, random = Math.random) {
    if (game === 'friends' && rounds === 0) return {a:1,b:1,level:0};
    const first = game === 'friends' ? 0 : 3;
    const last = first + 2;
    let level = first;
    while (level < last && evidence(attempts, level).mastered) level++;
    const recent = evidence(attempts, level).recent;
    const needsSupport = recent.length >= 2 && recent.slice(-2).every(p => !independent(p));
    const previous = attempts.filter(p => p.game === game).at(-1);
    const justReviewed = previous && previous.level < level;
    if (level > first && !justReviewed && (needsSupport || (rounds > 0 && rounds % 6 === 0))) level--;
    const lastFacts = attempts.filter(p => p.level === level).slice(-4);
    const seen = new Set(lastFacts.slice(-2).map(p => fact(p.a, p.b)));
    const candidates = pools[level].filter(([a,b]) => !seen.has(fact(a,b)));
    const revisit = lastFacts.slice(0,-2).find(p => !independent(p) && !seen.has(fact(p.a,p.b)));
    if (revisit && random() < 0.45) return {a:revisit.a, b:revisit.b, level};
    const options = needsSupport ? candidates.filter(([a,b]) => Math.min(a,b) <= 3 || (a % 10 + b % 10) <= 5) : candidates;
    const choices = options.length ? options : candidates;
    const [a,b] = choices[Math.floor(random() * choices.length)];
    return {a,b,level};
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = {stages, independent, evidence, stageOf, levelOf, choose};
    return;
  }

  // Shared picture badges let beginning readers recognize their own profile in either game.
  function avatar(code) {
    const animals = {
      fox:{bg:'#ffe6c5', fur:'#de864b', ears:'M12 24 10 9 24 17M36 17 50 9 48 24', cheeks:true},
      bunny:{bg:'#eee3f1', fur:'#c7a6ce', ears:'M17 25C7 6 16-4 22 7l5 15M33 22l4-15c6-12 16-2 7 18'},
      bear:{bg:'#f5e5cc', fur:'#bc9069', round:true},
      cat:{bg:'#dcebe5', fur:'#87aaa1', ears:'M12 26 12 9l14 11m9-1L47 9l2 18'},
    };
    const animal = animals[code] || animals.fox;
    const ears = animal.round ? '<circle cx="16" cy="21" r="8"/><circle cx="43" cy="21" r="8"/>' : '<path d="'+animal.ears+'"/>';
    const cheeks = animal.cheeks ? '<path fill="#fff3d9" d="M10 31q12 0 20 10 8-10 20-10-1 17-20 17T10 31"/>' : '<ellipse cx="30" cy="38" rx="9" ry="7" fill="#fff0da"/>';
    return '<svg class="avatar" width="42" height="42" viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="29" fill="'+animal.bg+'"/><g fill="'+animal.fur+'">'+ears+'<ellipse cx="30" cy="32" rx="20" ry="16"/></g>'+cheeks+'<g fill="#343934"><circle cx="21" cy="30" r="2"/><circle cx="39" cy="30" r="2"/><path d="M26 36q4-3 8 0l-4 4Z"/></g></svg>';
  }
  const key = 'trio.somas.';
  const pendingPrefix = key + 'pending.';
  const fresh = () => ({attempts:[], total:0, independent:0, counts:{friends:0, blocks:0}});
  let parent = null, children = [], child = null, available = false, progressReady = true;
  let guest = fresh(), progress = fresh(), generation = 0;
  const drains = new Map();
  const visitor = () => get('sessionStorage',key+'visitor') === 'yes';
  const get = (storage, k) => { try { return window[storage].getItem(k); } catch { return null; } };
  const put = (storage, k, v) => {
    try {
      if (v == null) window[storage].removeItem(k);
      else window[storage].setItem(k, v);
      return true;
    } catch { return false; }
  };
  try { guest = JSON.parse(get('sessionStorage', key+'guest')) || fresh(); } catch {}
  const state = () => child ? progress : guest;
  function notice(message) {
    let box = document.getElementById('sum-sync-status');
    if (!box) {
      box = document.createElement('div');
      box.id = 'sum-sync-status';
      box.setAttribute('role', 'status');
      Object.assign(box.style, {position:'fixed', bottom:'1rem', left:'50%', transform:'translateX(-50%)',
        width:'max-content', maxWidth:'90vw', padding:'.75rem 1rem', borderRadius:'12px',
        background:'#253a35', color:'white', zIndex:'9999', font:'bold 14px/1.4 system-ui', pointerEvents:'none'});
      document.body.append(box);
    }
    box.textContent = message;
    clearTimeout(notice.timer);
    notice.timer = setTimeout(() => box.remove(), 7000);
  }
  async function request(path, body) {
    const method = body === undefined ? 'GET' : 'POST';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/family/' + path, {method, credentials:'same-origin',
        cache:'no-store', signal:controller.signal,
        ...(body === undefined ? {} : {headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)})});
      if (!response.headers.get('content-type')?.includes('application/json')) throw Error('Não conseguimos falar com a área da família. Tente novamente.');
      const data = await response.json();
      if (!response.ok) {
        const error = Error(data.error || 'Não foi possível concluir. Tente novamente.');
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (error instanceof TypeError || error.name === 'AbortError') throw Error('Confira a conexão e tente novamente.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function pendingFor(id) {
    const result = [];
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(pendingPrefix + id + '.')) result.push(JSON.parse(localStorage.getItem(k)));
      }
    } catch {}
    return result.sort((a,b) => a.time-b.time).map(item => item.attempt);
  }
  function applyAttempt(s, attempt) {
    if (s.attempts.some(p => p.id === attempt.id)) return;
    // Keep the same per-skill evidence window returned by the server.
    const same = s.attempts.filter(p => p.level === attempt.level);
    if (same.length >= 12) s.attempts.splice(s.attempts.indexOf(same[0]), 1);
    s.attempts.push(attempt);
    s.total++;
    if (independent(attempt)) s.independent++;
    s.counts[attempt.game]++;
  }
  async function send(id, attempt) {
    await request('children/' + encodeURIComponent(id) + '/attempts', attempt);
    put('localStorage', pendingPrefix + id + '.' + attempt.id, null);
  }
  // One drain per child. A later success must never overtake an earlier offline round.
  function flush(id) {
    const previous = drains.get(id) || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      for (const attempt of pendingFor(id)) await send(id, attempt);
    });
    drains.set(id,operation);
    return operation.finally(() => {
      if (drains.get(id) === operation) drains.delete(id);
    });
  }
  async function select(id) {
    const version = ++generation;
    child = children.find(c => c.id === id) || null;
    if (child) put('sessionStorage',key+'visitor',null);
    put('sessionStorage', key+'child', child?.id ?? null);
    progress = fresh();
    progressReady = !child;
    if (!child) return;
    try {
      await flush(id);
      const result = await request('children/' + encodeURIComponent(id) + '/progress');
      if (version !== generation) return;
      progress = result;
      progressReady = true;
    } catch {
      if (version === generation) notice('Não foi possível carregar o progresso. Volte ao jardim para tentar de novo.');
    }
  }
  async function useSession(session) {
    const was = parent?.id;
    parent = session.parent;
    children = session.children;
    available = true;
    if (was && was !== parent?.id) put('sessionStorage', key+'child', null);
    let id = get('sessionStorage', key+'child');
    if (!children.some(c => c.id === id)) id = null;
    await select(id);
  }
  async function refresh() {
    try {
      const session = await request('session');
      if (!session.parent && get('sessionStorage',key+'child')) {
        put('sessionStorage',key+'expired','yes');
        notice('A sessão da família terminou. Entre de novo para retomar o perfil.');
      }
      if (session.parent) put('sessionStorage',key+'expired',null);
      await useSession(session);
    } catch {
      available = false;
      if (get('sessionStorage', key+'child')) {
        progressReady = false;
        notice('Sua família está desconectada. Volte ao jardim para reconectar.');
      }
    }
  }
  function problem(game, a, b, level = levelOf(game,a,b)) {
    // getRandomValues also works on local HTTP development origins.
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, n => n.toString(16).padStart(2,'0')).join('');
    const id = [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
    return {id,game,a,b,level,childId:child?.id ?? null};
  }
  function next(game) {
    const {a,b,level} = choose(state().attempts, game, state().counts[game]);
    return problem(game,a,b,level);
  }
  async function complete(round, {mistakes = 0, assisted = false} = {}) {
    if (!round || round.childId !== (child?.id ?? null)) return;
    const {id,game,a,b,level} = round;
    const attempt = {id,game,a,b,level,mistakes:Math.min(99,Math.max(0,Math.trunc(mistakes))),assisted:!!assisted};
    if (state().attempts.some(p => p.id === id)) return;
    if (!progressReady && !child) { notice('Família desconectada. Esta rodada não foi salva.'); return; }
    applyAttempt(state(),attempt);
    if (!child) { put('sessionStorage', key+'guest', JSON.stringify(guest)); return; }
    const childId = child.id;
    const queued = put('localStorage', pendingPrefix+childId+'.'+id, JSON.stringify({time:Date.now(),attempt}));
    try { if (queued) await flush(childId); else await send(childId,attempt); }
    catch { notice(queued ? 'Rodada guardada neste aparelho. Vamos sincronizar quando você reconectar.' : 'Não foi possível salvar a rodada. Confira a conexão.'); }
  }
  const ready = refresh();
  addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
  addEventListener('storage', e => { if (e.key === key+'account') location.reload(); });
  addEventListener('online', () => { if (child) flush(child.id).catch(() => {}); });
  window.SumJourney = {
    ready, refresh, request, useSession, select, avatar, stages, evidence, stageOf, complete, next, problem,
    get parent() { return parent; }, get child() { return child; }, get children() { return children; },
    get available() { return available; }, get progressReady() { return progressReady; }, get progress() { return state(); },
    count:game => state().counts[game], recommendedGame:() => stageOf(state().attempts) < 3 ? 'friends' : 'blocks',
    get entryGate() {
      if (!progressReady || get('sessionStorage',key+'expired')) return '#familia';
      return parent && !child && !visitor() ? '#perfis' : '';
    },
    async selectGuest() {
      put('sessionStorage',key+'expired',null);
      put('sessionStorage',key+'visitor','yes');
      await select(null);
    },
    accountChanged() {
      put('sessionStorage',key+'expired',null);
      put('sessionStorage',key+'visitor',null);
      put('localStorage', key+'account', String(Date.now()));
    },
  };
})();
