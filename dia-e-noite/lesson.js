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

    function icon(name) {
      return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
    }

    function action(label, name, disabled = false, extraClass = '') {
      return `<button type="button" class="lesson-action ${extraClass}" data-lesson-action="${name}"${disabled ? ' disabled' : ''}>${label}</button>`;
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
            copy: 'Na brincadeira, seu corpo era a Terra e seu rosto era um lugar. Aqui, o ponto rosa é o lugar da criança no jardim.',
            extra: '<div class="lesson-mapping"><span>Seu corpo <b>→</b> Terra</span><span>Seu rosto <b>→</b> ponto rosa <b>→</b> criança</span></div>',
            actions: action('Vamos prever', 'next'),
          };
        case 2:
          return {
            title: 'Como vai ficar?',
            copy: 'Se a Terra der meia volta, como ficará o céu no lugar da criança?',
            extra: `<div class="lesson-choices">${choice('Claro, de dia', 'day', 'sun', prediction === 'day')}${choice('Escuro, de noite', 'night', 'night', prediction === 'night')}</div>`,
            actions: action('Testar minha ideia', 'next', prediction === null),
          };
        case 3:
          return {
            title: observed ? 'Olhe o que aconteceu' : 'Vamos girar e conferir',
            copy: observed ? 'Compare o ponto rosa com o céu da criança.' : 'Arraste a Terra ou toque no botão. Acompanhe o ponto rosa e o céu juntos.',
            extra: '',
            actions: action(`${icon('turn')}<span>Girar meia volta</span>`, 'turn', observed, 'lesson-turn') + action('O que fez mudar?', 'next', !observed),
          };
        case 4:
          return {
            title: 'Por que ficou de noite?',
            copy: 'O que fez nosso lugar deixar de receber a luz do Sol?',
            extra: `<div class="lesson-choices lesson-causes">${choice('A Terra girou', 'earth', 'turn', causeChoice === 'earth', causeCorrect)}${choice('O Sol apagou', 'sun-off', 'sun', causeChoice === 'sun-off', causeCorrect)}${choice('A Terra se afastou', 'away', 'back', causeChoice === 'away', causeCorrect)}</div>`,
            actions: action('E no outro lugar?', 'next', !causeCorrect),
          };
        default:
          return {
            title: transferAnswered ? 'Dois lugares, ao mesmo tempo' : 'E no outro lugar?',
            copy: transferAnswered ? 'Compare os dois lugares sem girar a Terra.' : 'No ponto rosa é noite. Como estará o céu no ponto do outro lado da Terra?',
            extra: transferAnswered
              ? `<div class="lesson-choices">${action('Ver nosso lugar', 'view-home', false, observer === 0 ? 'is-selected' : 'lesson-secondary')}${action('Ver outro lugar', 'view-other', false, observer === 1 ? 'is-selected' : 'lesson-secondary')}</div>`
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
    }

    function exit() {
      active = false;
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
      feedback = `Você imaginou ${predicted}. Depois do giro, nosso lugar ficou sem a luz do Sol. Ficou de noite!`;
      adapter.pause();
      adapter.setLock(true);
      panel.dataset.result = result;
      panel.querySelector('#lessonTitle').textContent = 'Olhe o que aconteceu';
      panel.querySelector('.lesson-copy').textContent = 'Compare o ponto rosa com o céu da criança.';
      panel.querySelector('#lessonFeedback').textContent = feedback;
      panel.querySelector('[data-lesson-action="turn"]').disabled = true;
      panel.querySelector('[data-lesson-action="next"]').disabled = false;
    }

    function answer(value) {
      if (step === 2 && (value === 'day' || value === 'night')) {
        if (firstPrediction === null) firstPrediction = value;
        prediction = value;
        result = 'predicted';
        feedback = 'Sua ideia está escolhida. Agora vamos testar.';
      } else if (step === 4 && !causeCorrect && ['earth', 'sun-off', 'away'].includes(value)) {
        if (causeFirstAnswer === null) causeFirstAnswer = value;
        causeChoice = value;
        causeCorrect = value === 'earth';
        result = causeCorrect ? 'explained' : 'retry';
        feedback = causeCorrect
          ? 'A Terra girou! Nosso lugar ficou sem luz, mas o Sol continua iluminando o outro lado.'
          : value === 'sun-off'
            ? 'Olhe o Sol: ele continua aceso. Observe o que a Terra fez e tente de novo.'
            : 'A Terra não se afastou do Sol. Ela continuou no mesmo lugar. Observe o que mudou e tente de novo.';
      } else if (step === 5 && !transferAnswered && (value === 'day' || value === 'night')) {
        transferFirstAnswer = value;
        transferAnswered = true;
        observer = 1;
        result = value === 'day' ? 'confirmed' : 'compared';
        feedback = 'No outro lugar é dia: a luz do Sol chega até lá. Ao mesmo tempo, no ponto rosa é noite.';
        render(false);
        adapter.setObserver(1);
        panel.querySelector('[data-lesson-action="view-other"]').focus({ preventScroll: true });
        return;
      } else return;
      render(false);
      const selected = panel.querySelector(`[data-lesson-answer="${value}"]`);
      if (causeCorrect && step === 4) panel.querySelector('#lessonNext').focus({ preventScroll: true });
      else selected?.focus({ preventScroll: true });
    }

    panel.addEventListener('click', event => {
      if (!active) return;
      const button = event.target.closest('button');
      if (!button || !panel.contains(button) || button.disabled) return;
      if (button.dataset.lessonAnswer) { answer(button.dataset.lessonAnswer); return; }
      switch (button.dataset.lessonAction) {
        case 'exit': case 'finish': exit(); break;
        case 'body-done': case 'body-imagine': if (step === 0) enter(1); break;
        case 'next':
          if (step === 1 || (step === 2 && prediction !== null) || (step === 3 && observed) || (step === 4 && causeCorrect)) enter(step + 1);
          break;
        case 'turn': if (step === 3 && !observed) adapter.turnToNight(); break;
        case 'view-home': case 'view-other':
          if (step !== 5 || !transferAnswered) return;
          observer = button.dataset.lessonAction === 'view-other' ? 1 : 0;
          adapter.setObserver(observer);
          render(false);
          panel.querySelector(`[data-lesson-action="${observer ? 'view-other' : 'view-home'}"]`).focus({ preventScroll: true });
          break;
      }
    });
    document.getElementById('startLesson')?.addEventListener('click', start);
    render(false);
    return { start, exit, update };
  }

  return { create };
});
