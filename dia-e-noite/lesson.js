/* A short, adult-supported investigation: embody, compare, predict, test, explain, transfer. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DayNightLesson = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const stages = ['body', 'compare', 'predict', 'rotate', 'explain', 'transfer'];

  function create(adapter) {
    const panel = document.getElementById('lessonPanel');
    if (!panel) throw new Error('DayNightLesson needs #lessonPanel.');

    let active = false;
    let step = 0;
    let prediction = null;
    let firstPrediction = null;
    let causeFirstAnswer = null;
    let causeChoice = null;
    let causeCorrect = false;
    let transferFirstAnswer = null;
    let transferAnswered = false;
    let observed = false;
    let observer = 0;
    let result = '';
    let feedback = '';
    let narrationId = null;

    function speak(id) {
      narrationId = id;
      adapter.speak?.(id);
    }

    function icon(name) {
      const drawings = {
        next: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
        done: '<path d="m5 12 4 4L19 6"/>',
        imagine: '<path d="M7 16a5 5 0 0 1-2-9 5 5 0 0 1 8-3 5 5 0 1 1 4 12H7Z"/><circle cx="6" cy="20" r="1"/>',
        explore: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6Z"/>',
        'sun-off': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M3 21 21 3"/>',
        away: '<circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><path d="M6 12H1m3-3-3 3 3 3m14-3h5m-3-3 3 3-3 3"/>',
        'home-marker': '<circle cx="12" cy="12" r="6" fill="#ec5c84" stroke="#ec5c84"/>',
        'other-marker': '<path d="m12 4 8 8-8 8-8-8Z" fill="#36bfa0" stroke="#36bfa0"/>',
      };
      if (drawings[name]) return `<svg viewBox="0 0 24 24" aria-hidden="true">${drawings[name]}</svg>`;
      return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
    }

    function action(label, name, disabled = false, extraClass = '') {
      const symbols = { next: 'next', 'body-done': 'done', 'body-imagine': 'imagine', exit: 'explore', finish: 'explore', 'view-home': 'home-marker', 'view-other': 'other-marker', turn: 'turn' };
      return `<button type="button" class="lesson-action ${extraClass}" data-lesson-action="${name}"${disabled ? ' disabled' : ''}>${icon(symbols[name])}<span>${label}</span></button>`;
    }

    function choice(label, answer, symbol, selected = false, disabled = false) {
      return `<button type="button" class="lesson-choice${selected ? ' is-selected' : ''}" data-lesson-answer="${answer}" aria-pressed="${selected}"${disabled ? ' disabled' : ''}>${icon(symbol)}<span>${label}</span></button>`;
    }

    function content() {
      switch (step) {
        case 0:
          return {
            title: 'Brinque de ser a Terra',
            copy: 'Com um adulto: uma luminária parada faz de conta que é o Sol. Imagine que seu corpo é a Terra e seu rosto é um lugar nela. Vire devagar no lugar, ou gire um boneco.',
            extra: '<p class="lesson-mapping">De frente para a luz. Depois, de costas. O que mudou?</p>',
            actions: action('Já fiz o giro', 'body-done') + action('Vou imaginar', 'body-imagine', false, 'lesson-secondary'),
          };
        case 1:
          return {
            title: 'É o mesmo lugar',
            copy: 'Na brincadeira, seu corpo era a Terra e seu rosto era um lugar. Aqui, o ponto rosa marca Taubaté, o lugar da criança no jardim.',
            extra: '<div class="lesson-mapping"><span>Seu corpo <b>→</b> Terra</span><span>Seu rosto <b>→</b> ponto rosa <b>→</b> criança</span></div>',
            actions: action('Vamos prever', 'next'),
          };
        case 2:
          return {
            title: 'Como vai ficar?',
            copy: 'Se a Terra der meia volta, como ficará o céu em Taubaté?',
            extra: `<div class="lesson-choices">${choice('Claro, de dia', 'day', 'sun', prediction === 'day')}${choice('Escuro, de noite', 'night', 'night', prediction === 'night')}</div>`,
            actions: action('Testar minha ideia', 'next', prediction === null),
          };
        case 3:
          return {
            title: observed ? 'Olhe o que aconteceu' : 'Vamos girar e conferir',
            copy: observed ? 'Compare o ponto rosa com o céu da criança.' : 'Arraste a Terra ou toque no botão. Acompanhe o ponto rosa e o céu juntos.',
            extra: '',
            actions: action('Girar meia volta', 'turn', observed, 'lesson-turn') + action('O que fez mudar?', 'next', !observed),
          };
        case 4:
          return {
            title: 'Por que ficou de noite?',
            copy: 'O que fez Taubaté deixar de receber a luz do Sol?',
            extra: `<div class="lesson-choices lesson-causes">${choice('A Terra girou', 'earth', 'turn', causeChoice === 'earth', causeCorrect)}${choice('O Sol apagou', 'sun-off', 'sun-off', causeChoice === 'sun-off', causeCorrect)}${choice('A Terra se afastou', 'away', 'away', causeChoice === 'away', causeCorrect)}</div>`,
            actions: action('E no outro lugar?', 'next', !causeCorrect),
          };
        default:
          return {
            title: transferAnswered ? 'Dois lugares, ao mesmo tempo' : 'E no outro lugar?',
            copy: transferAnswered ? 'Compare os dois lugares sem girar a Terra.' : 'Em Taubaté, no ponto rosa, é noite. Como estará o céu no ponto do outro lado da Terra?',
            extra: transferAnswered
              ? `<div class="lesson-choices">${action('Ver Taubaté', 'view-home', false, observer === 0 ? 'is-selected' : 'lesson-secondary')}${action('Ver outro lugar', 'view-other', false, observer === 1 ? 'is-selected' : 'lesson-secondary')}</div>`
              : `<div class="lesson-choices">${choice('Dia', 'day', 'sun')}${choice('Noite', 'night', 'night')}</div>`,
            actions: transferAnswered ? action('Continuar explorando', 'finish') : '',
          };
      }
    }

    function render(focusTitle = false) {
      const view = content();
      panel.hidden = !active;
      panel.dataset.stage = stages[step];
      panel.dataset.result = result;
      panel.innerHTML = `<div class="lesson-meta"><span>${step + 1} de ${stages.length}</span>${action('Explorar livremente', 'exit', false, 'lesson-exit')}</div>
        <h2 id="lessonTitle" tabindex="-1">${view.title}</h2>
        <p class="lesson-copy">${view.copy}</p>
        ${view.extra}
        <p id="lessonFeedback" class="lesson-feedback" role="status" aria-live="polite" aria-atomic="true">${feedback}</p>
        <div class="lesson-actions">${view.actions}</div>`;
      const nextButton = panel.querySelector('[data-lesson-action="next"]');
      if (nextButton) nextButton.id = 'lessonNext';
      if (step === 5 && transferAnswered) {
        panel.querySelector('[data-lesson-action="view-home"]').setAttribute('aria-pressed', String(observer === 0));
        panel.querySelector('[data-lesson-action="view-other"]').setAttribute('aria-pressed', String(observer === 1));
      }
      if (focusTitle && active) panel.querySelector('#lessonTitle').focus({ preventScroll: true });
    }

    function enter(nextStep) {
      step = nextStep;
      result = '';
      feedback = '';
      if (step === 3) observed = false;
      if (step === 5) {
        transferAnswered = false;
        observer = 0;
      }
      render(true);
      adapter.setLock(step !== 3);
      if (step === 1 || step === 2) {
        adapter.setObserver(0);
        adapter.setAngle(0);
      }
      if (step === 5) {
        adapter.pause();
        adapter.setObserver(0);
        adapter.setAngle(Math.PI);
        adapter.showOtherPlace(true);
      }
      speak(`lesson-${stages[step]}`);
    }

    function start() {
      active = true;
      step = 0;
      prediction = null;
      firstPrediction = null;
      causeFirstAnswer = null;
      causeChoice = null;
      causeCorrect = false;
      transferFirstAnswer = null;
      transferAnswered = false;
      observed = false;
      observer = 0;
      result = '';
      feedback = '';
      adapter.pause();
      adapter.setGuided(true);
      adapter.setLock(true);
      adapter.showOtherPlace(false);
      adapter.setObserver(0);
      adapter.setAngle(0);
      render(true);
      speak('lesson-body');
    }

    function exit() {
      active = false;
      narrationId = null;
      adapter.stopSpeech?.();
      panel.hidden = true;
      adapter.setObserver(0);
      adapter.showOtherPlace(false);
      adapter.setLock(false);
      adapter.setGuided(false);
    }

    function update(state) {
      if (!active || step !== 3 || observed || !state) return;
      if (!(state.elevation < -.6 && state.settled === true)) return;
      // Set the guard before adapter calls: pausing or locking may notify the lesson again.
      observed = true;
      result = 'observed';
      const predicted = prediction === 'night' ? 'noite' : 'dia';
      feedback = `Você imaginou ${predicted}. Depois do giro, Taubaté ficou sem a luz do Sol. Ficou de noite!`;
      adapter.pause();
      adapter.setLock(true);
      panel.dataset.result = result;
      panel.querySelector('#lessonTitle').textContent = 'Olhe o que aconteceu';
      panel.querySelector('.lesson-copy').textContent = 'Compare o ponto rosa com o céu da criança.';
      panel.querySelector('#lessonFeedback').textContent = feedback;
      panel.querySelector('[data-lesson-action="turn"]').disabled = true;
      panel.querySelector('[data-lesson-action="next"]').disabled = false;
      speak(`observed-${prediction}`);
    }

    function answer(value) {
      let nextNarration;
      if (step === 2 && (value === 'day' || value === 'night')) {
        if (prediction === value) return;
        if (firstPrediction === null) firstPrediction = value;
        prediction = value;
        result = 'predicted';
        feedback = 'Sua ideia está escolhida. Agora vamos testar.';
        nextNarration = `prediction-${value}`;
      } else if (step === 4 && !causeCorrect && ['earth', 'sun-off', 'away'].includes(value)) {
        if (causeChoice === value) return;
        if (causeFirstAnswer === null) causeFirstAnswer = value;
        causeChoice = value;
        causeCorrect = value === 'earth';
        result = causeCorrect ? 'explained' : 'retry';
        feedback = causeCorrect
          ? 'A Terra girou! Taubaté ficou sem luz, mas o Sol continua iluminando o outro lado.'
          : value === 'sun-off'
            ? 'Olhe o Sol: ele continua aceso. Observe o que a Terra fez e tente de novo.'
            : 'A Terra não se afastou do Sol. Ela continuou no mesmo lugar. Observe o que mudou e tente de novo.';
        nextNarration = causeCorrect ? 'cause-correct' : `cause-${value}`;
      } else if (step === 5 && !transferAnswered && (value === 'day' || value === 'night')) {
        transferFirstAnswer = value;
        transferAnswered = true;
        observer = 1;
        result = value === 'day' ? 'confirmed' : 'compared';
        feedback = 'No outro lugar é dia: a luz do Sol chega até lá. Ao mesmo tempo, em Taubaté é noite.';
        render(false);
        adapter.setObserver(1);
        panel.querySelector('[data-lesson-action="view-other"]').focus({ preventScroll: true });
        speak(`transfer-${value}`);
        return;
      } else return;
      render(false);
      const selected = panel.querySelector(`[data-lesson-answer="${value}"]`);
      if (causeCorrect && step === 4) panel.querySelector('#lessonNext').focus({ preventScroll: true });
      else selected?.focus({ preventScroll: true });
      speak(nextNarration);
    }

    panel.addEventListener('click', event => {
      if (!active) return;
      const button = event.target.closest('button');
      if (!button || !panel.contains(button) || button.disabled) return;
      if (button.dataset.lessonAnswer) { answer(button.dataset.lessonAnswer); return; }
      switch (button.dataset.lessonAction) {
        case 'exit': exit(); break;
        case 'finish': exit(); speak('lesson-finish'); break;
        case 'body-done': case 'body-imagine': if (step === 0) enter(1); break;
        case 'next':
          if (step === 1 || (step === 2 && prediction !== null) || (step === 3 && observed) || (step === 4 && causeCorrect)) enter(step + 1);
          break;
        case 'turn': if (step === 3 && !observed) adapter.turnToNight(); break;
        case 'view-home': case 'view-other':
          if (step !== 5 || !transferAnswered) return;
          const nextObserver = button.dataset.lessonAction === 'view-other' ? 1 : 0;
          if (observer === nextObserver) return;
          observer = nextObserver;
          adapter.setObserver(observer);
          render(false);
          panel.querySelector(`[data-lesson-action="${observer ? 'view-other' : 'view-home'}"]`).focus({ preventScroll: true });
          speak(observer ? 'view-other' : 'view-home');
          break;
      }
    });
    document.getElementById('startLesson')?.addEventListener('click', start);
    render(false);
    return { start, exit, update, currentNarration: () => active ? narrationId : null };
  }

  return { create };
});
