(() => {
  'use strict';
  const J = window.SumJourney;
  const $ = id => document.getElementById(id);
  const panel = $('panel'), content = $('panel-body');
  const icon = name => '<svg class="icon" aria-hidden="true"><use href="#' + name + '"/></svg>';
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const animals = {fox:'Raposa',bunny:'Coelho',bear:'Urso',cat:'Gato'};
  const routes = {friends:'../numberblocks-somar/index.html?trilha=1', blocks:'../numberblocks-1-100/blocos-de-somar.html?trilha=1'};
  let busy = false, initialized = false;
  document.querySelectorAll('[data-number]').forEach(slot => {
    const figure = Numberblocks.create(Number(slot.dataset.number));
    if (slot.dataset.number === '2') figure.classList.add('acena');
    slot.append(figure);
  });

  function paintGarden() {
    const child = J.child, p = J.progress, stage = J.stageOf(p.attempts);
    $('profile-avatar').innerHTML = child ? J.avatar(child.avatar) : icon('user');
    $('profile-name').textContent = child ? child.name : 'Quem joga?';
    $('welcome').textContent = child
      ? (p.total ? child.name + ', vamos brincar mais um pouco? Sua próxima descoberta é ' + J.stages[stage].toLocaleLowerCase('pt-BR') + '.' : child.name + ', os Numberblocks estão esperando por você. Vamos juntar os primeiros amigos?')
      : 'Junte os Numberblocks e descubra quem aparece quando dois amigos viram um só.';
    const play = $('play');
    play.href = routes[J.recommendedGame()];
    play.innerHTML = (p.total ? 'Continuar brincando ' : 'Começar a brincar ') + icon('arrow');
    $('save-note').textContent = child ? 'Jogando com o perfil de ' + child.name : J.parent && J.entryGate ? 'Escolha uma criança para guardar as descobertas.' : 'Você pode brincar como visitante.';
    if (!J.progressReady) $('save-note').textContent = 'Não conseguimos carregar o progresso. Reconecte a família para continuar.';
  }
  const action = (view, label) => '<button class="link-button" type="button" data-view="' + view + '">' + label + '</button>';
  const close = () => { if (panel.open) panel.close(); };
  function profiles() {
    const title = '<h2 id="panel-title">Quem vai brincar?</h2>';
    if (!J.parent) return `${title}
      <p class="intro">Peça a um adulto para abrir a conta da família e escolher seu bichinho.</p>
      <div class="choices">
        <button class="primary" type="button" data-view="family">Acessar a família</button>
        <button class="profile-row" type="button" data-action="guest"><span>Brincar como visitante</span>${icon('arrow')}</button>
      </div>`;
    const list = J.children.map(c => `
      <button type="button" class="profile-row" data-child="${esc(c.id)}">
        ${J.avatar(c.avatar)}<span>${esc(c.name)}</span>
        ${J.child?.id === c.id ? '<small>Em jogo</small>' : ''}${icon('arrow')}
      </button>`).join('');
    return `${title}
      <p class="intro">${list ? 'Toque no seu bichinho para entrar no jardim.' : 'Cada criança tem um bichinho e um caminho só dela.'}</p>
      <div class="choices">${list}</div>
      <div class="panel-nav">
        ${action('add','Cadastrar criança')}
        <button type="button" class="link-button" data-action="guest">Brincar como visitante</button>
      </div>`;
  }
  function auth(register) {
    const intro = register
      ? 'Use o e-mail do adulto. Para as crianças, basta um nome ou apelido.'
      : 'Entre para escolher quem vai brincar e acompanhar as descobertas de cada criança.';
    return `<h2 id="panel-title">${register ? 'Criar conta da família' : 'Área dos pais'}</h2>
      <p class="intro">${intro}</p>
      <form data-form="${register ? 'register' : 'login'}">
        <label class="field">E-mail do adulto
          <input type="email" name="email" required autocomplete="username" maxlength="254" autocapitalize="none" spellcheck="false">
        </label>
        <label class="field">Senha
          <input type="password" name="password" required autocomplete="${register ? 'new-password' : 'current-password'}"
            ${register ? 'minlength="15"' : ''} maxlength="128">
          ${register ? '<small>Use pelo menos 15 caracteres. Uma frase é mais fácil de lembrar.</small>' : ''}
        </label>
        <button class="primary">${register ? 'Criar minha conta' : 'Entrar'}</button>
      </form>
      <div class="panel-nav">${register ? action('family','Já tenho conta') : action('register','Criar conta da família')}</div>`;
  }
  function addChild() {
    const badges = Object.entries(animals).map(([code,name],i) => `
      <label class="animal">
        <input type="radio" name="avatar" value="${code}" ${i === 0 ? 'checked' : ''}>
        <span>${J.avatar(code)}${name}</span>
      </label>`).join('');
    return `<h2 id="panel-title">Uma nova criança</h2>
      <p class="intro">Escolha o nome e o bichinho que ela vai procurar na hora de brincar.</p>
      <form data-form="add">
        <label class="field">Nome ou apelido<input name="name" autocomplete="off" maxlength="32" required></label>
        <fieldset><legend>Meu bichinho</legend><div class="animals">${badges}</div></fieldset>
        <button class="primary">Guardar perfil</button>
      </form>
      <div class="panel-nav">${action('profiles','Voltar aos perfis')}</div>`;
  }
  function family() {
    const p = J.progress, child = J.child;
    let report = '<p class="intro">Escolha uma criança para ver como ela está brincando.</p>';
    if (child && J.progressReady) {
      const stage = J.stageOf(p.attempts);
      const skills = J.stages.map((label, i) => {
        const e = J.evidence(p.attempts,i);
        const status = e.mastered ? 'Com autonomia' : e.recent.length ? 'Praticando' : i === stage ? 'Próxima descoberta' : 'Por explorar';
        return '<li'+(i === stage ? ' data-current':'')+'>'+label+'<span>'+status+'</span></li>';
      }).join('');
      report = `<h3>Descobertas de ${esc(child.name)}</h3>
        <div class="stats">
          <div class="stat"><strong>${p.total}</strong>rodadas concluídas</div>
          <div class="stat"><strong>${p.independent}</strong>sem ajuda ou erro</div>
        </div>
        <ul class="skill-list">${skills}</ul>
        <p class="intro">A trilha observa as últimas rodadas de cada etapa. Contar com ajuda também faz parte. Cada criança pode levar o tempo que precisar.</p>`;
    } else if (!J.progressReady) {
      report = '<p class="intro">O progresso está indisponível.</p>'+action('retry','Tentar novamente');
    }
    return `<h2 id="panel-title">Área da família</h2>
      <p class="intro">${esc(J.parent.email)}</p>${report}
      <div class="choices"><button class="primary" type="button" data-view="profiles">Escolher criança</button></div>
      <div class="panel-nav">
        ${action('add','Cadastrar criança')}
        <button type="button" class="link-button" data-action="logout">Sair da conta</button>
      </div>`;
  }

  function show(view) {
    if (!J.parent && (view === 'add' || view === 'register' || view === 'family') && !J.available) {
      content.innerHTML = `<h2 id="panel-title">Vamos reconectar?</h2>
        <p class="intro">A área da família está indisponível. Tente conectar de novo ou explore o jardim como visitante nesta aba.</p>
        <div class="choices">
          <button type="button" class="primary" data-view="retry">Tentar novamente</button>
          <button type="button" class="profile-row" data-action="guest">Brincar como visitante</button>
        </div>`;
    } else {
      if (!J.parent && view === 'add') view = 'register';
      if (view === 'profiles') content.innerHTML = profiles();
      else if (view === 'add') content.innerHTML = addChild();
      else if (J.parent) content.innerHTML = family();
      else content.innerHTML = auth(view === 'register');
    }
    content.insertAdjacentHTML('beforeend','<p id="family-error" class="error" role="alert"></p>');
    if (!panel.open) panel.showModal();
    const heading = $('panel-title');
    heading.tabIndex = -1;
    heading.focus({preventScroll:true});
    panel.scrollTop = 0;
  }
  function lock(value) {
    busy = value;
    for (const button of panel.querySelectorAll('button')) button.disabled = value;
  }
  async function perform(work) {
    if (busy) return;
    lock(true);
    try { await work(); }
    catch (e) {
      if (e.status === 401 && J.parent) {
        await J.refresh();
        paintGarden();
        show('family');
      }
      if ($('family-error')) $('family-error').textContent = e.message;
    } finally { lock(false); }
  }
  async function start(view) {
    if (view === 'retry') {
      await perform(async () => { await J.refresh(); paintGarden(); show('family'); });
    } else show(view);
  }
  document.addEventListener('click', async e => {
    const el = e.target.closest('button,a');
    if (!el) return;
    if (!initialized && (el.dataset.view || el.closest('main'))) {
      e.preventDefault();
      await J.ready;
      if (initialized) el.click();
      return;
    }
    if (el.closest('main') && el.matches('a') && J.entryGate) {
      e.preventDefault(); show(J.entryGate === '#perfis' ? 'profiles' : 'family'); return;
    }
    if (el.dataset.view) { await start(el.dataset.view); return; }
    if (el.dataset.child) {
      await perform(async () => {
        await J.select(el.dataset.child);
        if (!J.progressReady) throw Error('O progresso não carregou. Escolha o perfil de novo.');
        paintGarden(); close();
      });
    } else if (el.dataset.action === 'logout') {
      await perform(async () => {
        await J.request('logout',{}); await J.useSession({parent:null,children:[]});
        J.accountChanged(); paintGarden(); show('family');
      });
    } else if (el.dataset.action === 'guest') {
      await J.selectGuest();
      paintGarden();
      close();
    } else if (el.dataset.action === 'close') close();
  });
  panel.addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target, data = Object.fromEntries(new FormData(form));
    perform(async () => {
      if (form.dataset.form === 'add') {
        const {child} = await J.request('children',{...data,parentId:J.parent.id});
        await J.useSession({parent:J.parent, children:[...J.children,child]});
        if (J.child?.id !== child.id) await J.select(child.id);
        paintGarden(); show('profiles');
      } else {
        const session = await J.request(form.dataset.form,data);
        J.accountChanged();
        form.reset();
        await J.useSession(session);
        paintGarden(); show(J.children.length ? 'profiles' : 'add');
      }
    });
  });
  panel.addEventListener('cancel',e => { if (busy) e.preventDefault(); });
  panel.addEventListener('close',() => {
    content.replaceChildren();
    if (location.hash) history.replaceState(null,'',location.pathname+location.search);
    if (!document.activeElement || document.activeElement === document.body) $('play').focus({preventScroll:true});
  });
  function fromHash() {
    if (location.hash === '#perfis') show('profiles');
    else if (location.hash === '#familia') show('family');
  }
  J.ready.then(() => {
    initialized = true;
    paintGarden(); fromHash();
    addEventListener('hashchange',fromHash);
  });
})();
