import { EX } from '../data/exercises.js';
import { engine } from '../engine/engine.js';
import { sfx } from '../engine/sfx.js';
import { hasRecognition, tts } from '../engine/speech.js';
import { store } from '../store.js';
import { h } from '../util.js';

export function parentScreen(root, nav) {
  const s = store.settings;
  const save = () => { store.saveSettings(); engine.applySettings(); sfx.enabled = s.sfx; tts.enabled = s.voice; };

  // ---- routine ----
  const rows = s.routine.map((r) => {
    const ex = EX[r.id];
    const reps = h('output', null, String(r.reps));
    const step = (d) => () => { r.reps = Math.max(1, Math.min(30, r.reps + d)); reps.textContent = String(r.reps); save(); };
    const id = `rt-${r.id}`;
    return h('li', { class: 'rt-row' + (r.on ? '' : ' off') },
      h('input', { type: 'checkbox', id, checked: r.on, onchange: (e) => { r.on = (e.target).checked; (e.target).closest('li').classList.toggle('off', !r.on); save(); } }),
      h('label', { for: id }, h('span', { class: 'rt-emoji' }, ex.emoji), ex.name),
      h('span', { class: 'stepper' },
        h('button', { 'aria-label': 'menos', onclick: step(-1) }, '−'), reps, h('button', { 'aria-label': 'mais', onclick: step(1) }, '+')));
  });

  // ---- sensitivity ----
  const slider = (label, key, help) => {
    const id = `sl-${key}`;
    const val = h('output', null, `${Math.round(s[key] * 100)}%`);
    return h('div', { class: 'slider' },
      h('label', { for: id }, h('b', null, label), val),
      h('input', { type: 'range', id, min: '0.6', max: '1.8', step: '0.05', value: String(s[key]),
        oninput: (e) => { s[key] = Number((e.target).value); val.textContent = `${Math.round(s[key] * 100)}%`; save(); } }),
      h('div', { class: 'slider-ends' }, h('span', null, 'mais rigoroso'), h('span', null, 'mais fácil')),
      h('small', null, help));
  };

  const toggle = (label, key, help, disabled = false) => {
    const id = `tg-${key}`;
    return h('div', { class: 'toggle' + (disabled ? ' disabled' : '') },
      h('input', { type: 'checkbox', id, checked: s[key], disabled, onchange: (e) => { s[key] = (e.target).checked; save(); } }),
      h('label', { for: id }, h('b', null, label), help ? h('small', null, help) : null));
  };

  // ---- history ----
  const days = Object.keys(store.progress.days).sort().reverse().slice(0, 21);
  const hist = days.length
    ? h('div', { class: 'table-wrap' }, h('table', { class: 'hist' },
        h('thead', null, h('tr', null, h('th', null, 'Dia'), h('th', null, 'Exercícios'), h('th', null, 'Repetições'), h('th', null, 'Pelo Dino'), h('th', null, 'Lábios em M/P'), h('th', null, 'Min'))),
        h('tbody', null, days.map((d) => {
          const logs = Object.entries(store.progress.days[d]);
          const done = logs.filter(([, l]) => l.done).length;
          const reps = logs.reduce((a, [, l]) => a + l.reps, 0);
          const auto = logs.reduce((a, [, l]) => a + l.auto, 0);
          const ck = logs.reduce((a, [, l]) => a + (l.checkOk ?? 0), 0);
          const ct = logs.reduce((a, [, l]) => a + (l.checkTotal ?? 0), 0);
          const ms = logs.reduce((a, [, l]) => a + l.ms, 0);
          const [y, m, dd] = d.split('-');
          return h('tr', { title: logs.map(([id, l]) => `${EX[id]?.name ?? id}: ${l.reps}x (${l.auto} detectadas, ${l.manual} com +1)`).join('\n') },
            h('td', null, `${dd}/${m}/${y.slice(2)}`),
            h('td', null, String(done)),
            h('td', null, String(reps)),
            h('td', null, reps ? `${Math.round((auto / reps) * 100)}%` : '–'),
            h('td', null, ct ? `${ck}/${ct}` : '–'),
            h('td', null, String(Math.round(ms / 60000))));
        }))))
    : h('p', { class: 'muted' }, 'Ainda sem treinos registrados.');

  // ---- erase, with an in-page confirmation ----
  const confirmBox = h('div', { class: 'confirm', hidden: true },
    h('p', null, 'Apagar histórico, figurinhas e ovos? Isso não pode ser desfeito.'),
    h('button', { class: 'btn-danger', onclick: () => { store.resetProgress(); nav.back(); } }, 'Apagar tudo'),
    h('button', { class: 'btn-ghost', onclick: () => { confirmBox.hidden = true; } }, 'Cancelar'));

  const knnInfo = engine.knn.ready()
    ? `Treinado com ${engine.knn.samples.length} quadros (${engine.knn.classesTrained().length} posições).`
    : 'Ainda não treinado: usando o detector automático de cor.';

  root.replaceChildren(h('div', { class: 'screen parent' },
    h('header', { class: 'ex-top' },
      h('button', { class: 'icon-btn', 'aria-label': 'Voltar', onclick: () => nav.back() }, '✕'),
      h('div', { class: 'ex-title' }, h('span', { class: 'ex-cat' }, 'Só para adultos'), h('h1', null, 'Área dos pais'))),
    h('div', { class: 'page parent-page' },
      h('section', { class: 'panel' },
        h('h2', null, 'Treino de hoje'),
        h('p', { class: 'muted' }, 'Marque os exercícios do treino diário e quantas vezes cada um. O bocejo sempre fica por último.'),
        h('ul', { class: 'rt-list' }, rows)),
      h('section', { class: 'panel' },
        h('h2', null, 'Sensibilidade do Dino'),
        slider('Lábios e bochechas', 'sensLabios', 'Bico, sorriso, beijo do vovô, bochechas, bocejo.'),
        slider('Língua', 'sensLingua', 'Fora/dentro, lados, cima/baixo, sorvete.'),
        slider('Sons e sopro', 'sensSom', 'Sopro, estalo, vibração, R, palavras. Aumente em ambiente silencioso se ele falar baixinho.')),
      h('section', { class: 'panel' },
        h('h2', null, 'Ferramentas'),
        h('div', { class: 'tools' },
          h('button', { class: 'tool', onclick: () => nav.detector() }, h('b', null, '🔬 Testar o detector'), h('small', null, 'Veja ao vivo o que a câmera e o microfone estão entendendo.')),
          h('button', { class: 'tool', onclick: () => nav.train() }, h('b', null, '👅 Ensinar a língua do Leo'), h('small', null, `Grave 3 s de cada posição da língua para o Dino aprender com ele. ${knnInfo}`)),
          h('button', { class: 'tool', onclick: () => nav.calibrate() }, h('b', null, '🪞 Refazer o espelho mágico'), h('small', null, 'Ajusta o rosto neutro. Feito sozinho a cada 30 min de uso.')))),
      h('section', { class: 'panel' },
        h('h2', null, 'Opções'),
        toggle('Voz do Dino', 'voice', 'Instruções faladas.'),
        toggle('Efeitos sonoros', 'sfx'),
        toggle('Mostrar o detector no jogo', 'debug', 'Contorno dos lábios, pixels da língua e números na tela.'),
        toggle('Reconhecimento de voz (beta)', 'speechRec', hasRecognition() ? 'Confere as palavras do trava-língua pelo serviço de voz do celular.' : 'Este navegador não oferece reconhecimento de voz.', !hasRecognition()),
        h('div', { class: 'slider' },
          h('label', { for: 'words-n' }, h('b', null, 'Palavras por bicho na fazendinha')),
          h('input', { type: 'number', id: 'words-n', min: '3', max: '22', value: String(s.wordsPerAnimal),
            onchange: (e) => {
              s.wordsPerAnimal = Math.max(3, Math.min(22, Number((e.target).value) || 8));
              for (const id of ['vaca', 'gato', 'pinto', 'galinha']) { const r = s.routine.find((x) => x.id === id); if (r) r.reps = s.wordsPerAnimal + 1; }
              save();
            } }))),
      h('section', { class: 'panel' },
        h('h2', null, 'Histórico'),
        h('p', { class: 'muted' }, '"Pelo Dino" é a parte das repetições que a câmera ou o microfone confirmaram sozinhos; o resto veio do botão +1. Toque numa linha para ver os exercícios.'),
        hist),
      h('section', { class: 'panel' },
        h('h2', null, 'Dicas para o detector'),
        h('ul', { class: 'tips' },
          h('li', null, 'Luz de frente para o rosto (janela ou lâmpada atrás do celular). Contraluz atrapalha a língua.'),
          h('li', null, 'Celular apoiado na altura do rosto, a uns 30–40 cm, câmera da frente.'),
          h('li', null, 'Se a língua não for reconhecida, use "Ensinar a língua do Leo": 20 segundos de gravação resolvem a maioria dos casos.'),
          h('li', null, 'O botão "+1 ajudinha" conta a repetição quando você vê que ele fez certo e o Dino não pegou.'))),
      h('section', { class: 'panel' },
        h('button', { class: 'btn-ghost', onclick: () => { confirmBox.hidden = false; } }, 'Apagar progresso…'),
        confirmBox),
    )));

  return () => {};
}
