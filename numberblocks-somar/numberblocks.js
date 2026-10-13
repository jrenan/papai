/* Personagens de blocos desenhados só com HTML e CSS.
   Modelo portado do convite do Rafa (rafa-4-anos/public/invitation.js), com dois acréscimos para o jogo:
   blocos vazios (a silhueta que a criança preenche) e cores trocadas por bloco (as partes de uma soma). */
(() => {
  'use strict';

  const NOMES = ['Zero', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove', 'Dez',
    'Onze', 'Doze', 'Treze', 'Catorze', 'Quinze', 'Dezesseis', 'Dezessete', 'Dezoito', 'Dezenove', 'Vinte'];
  // forma: [colunas, linhas]; ombro: de onde saem os braços, em blocos a partir do topo;
  // membro: braços e pernas; aro: olhos, óculos e sobrancelhas.
  const NB = {
    1: { cor: '#e8262b', borda: '#a8141b', forma: [1, 1], ombro: .42, membro: '#b5121b', olhos: 'um', aro: '#b5121b', labio: '#9e1b22' },
    2: { cor: '#f7931e', borda: '#c46c08', forma: [1, 2], ombro: 1.12, membro: '#8c5aa5', perna: '#5e3b70', pe: '#ff8a1f', olhos: 'oculos', aro: '#9b5fd6', labio: '#ff7f9e', boca: 'traco' },
    3: { cor: '#f6d42a', borda: '#c9a40a', forma: [1, 3], ombro: 1.12, membro: '#d6383c', olhos: 'aro', aro: '#ff8f1f', labio: '#d6262c', extra: 'coroa', botoes: true },
    4: { cor: '#46c33b', borda: '#2a8a24', forma: [2, 2], ombro: 1.12, membro: '#246c20', olhos: 'quadrado', aro: '#1f6b1d', labio: '#1f6b1d', sobrancelhas: true },
    5: { cor: '#3fd6f3', borda: '#169cbd', forma: [1, 5], ombro: 1.12, membro: '#2856a8', olhos: 'estrela1', aro: '#2856a8', labio: '#ff6f87' },
    6: { cor: '#5b33c6', borda: '#3d1f95', forma: [2, 3], ombro: 1.25, membro: '#9b2b4c', olhos: 'seis', aro: '#e2262d', labio: '#ff6fa8', ponto: '#8f95f2' },
    7: { forma: [1, 7], ombro: 1.05, membro: '#7b3fe0', olhos: 'oculos', aro: '#f5c518', labio: '#f5c518', extra: 'cabelo' },
    8: { cor: '#ec2ea0', borda: '#b0166f', forma: [2, 4], membro: '#8a1f60', olhos: 'mascara', aro: '#7a1556', labio: '#7a1556', bracos: 3 },
    9: { cor: '#a3acb6', borda: '#6f7883', forma: [3, 3], ombro: 1.2, membro: '#5d6670', olhos: 'quadrado', aro: '#56606b', labio: '#56606b', sobrancelhas: true },
    10: { cor: '#ffffff', borda: '#e3e3e3', forma: [2, 5], ombro: .35, membro: '#e53935', olhos: 'estrela', aro: '#e53935', labio: '#ff7f8f', contorno: '#e53935', mao: '#ffffff' }
  };
  // Sete é o arco-íris: lilás no topo e vermelho embaixo (lista de cima para baixo).
  const ARCO_IRIS = [['#b68cf0', '#8a5fd0'], ['#7b3fe0', '#5626b0'], ['#45d0ef', '#1aa3c4'], ['#3fbf2a', '#2a8a1c'],
    ['#f3e12a', '#c9b400'], ['#ff8f1c', '#d26a00'], ['#e8262b', '#a8141b']];
  // Dezenas: o Dez é branco com contorno vermelho; 20, 30 e 40 são laranja, amarelo e verde clarinhos.
  const DEZENAS = { 1: ['#ffffff', '#e3e3e3', '#e53935'], 2: ['#ffd9a3', '#f3b469', '#f08f1f'], 3: ['#fff2a0', '#eedb6a', '#d9b300'], 4: ['#c9f0bb', '#9fd98e', '#3fae35'] };
  const EXTRAS = {
    coroa: '<svg viewBox="0 0 60 36" aria-hidden="true"><path d="M5 34 L8 9 L20 23 L30 4 L40 23 L52 9 L55 34 Z" fill="#e8262b" stroke="#a8141b" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M20 23 L30 4 L40 23 L30 30 Z" fill="#ff7a1a"/><g fill="#ffd21a" stroke="#c99a00" stroke-width="1.5"><circle cx="8" cy="8" r="4.5"/><circle cx="30" cy="4.5" r="4.5"/><circle cx="52" cy="8" r="4.5"/></g></svg>',
    cabelo: '<svg viewBox="0 0 60 30" aria-hidden="true"><g stroke-linecap="round" stroke-width="7.5"><path d="M9 28 L5 9" stroke="#e8262b"/><path d="M18 28 L15 5" stroke="#ff8f1c"/>' +
      '<path d="M27 28 L26 3" stroke="#f3e12a"/><path d="M35 28 L37 3" stroke="#3fbf2a"/><path d="M44 28 L48 5" stroke="#45d0ef"/><path d="M52 28 L57 10" stroke="#7b3fe0"/></g></svg>'
  };
  const corDe = (n, doTopo) => n === 7 ? ARCO_IRIS[doTopo] : [NB[n].cor, NB[n].borda];

  /* Blocos na ordem em que se empilham: fileira de baixo primeiro, da esquerda para a direita. */
  function layout(n, { torre = false } = {}) {
    const cells = [];
    const add = (x, y, [c, cd]) => cells.push({ x, y, c, cd });
    let cols, rows, regiao;
    if (n <= 10) {
      [cols, rows] = torre ? [1, n] : NB[n].forma;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) add(x, y, corDe(n, rows - 1 - y));
      regiao = { cols, rows, topo: 0 };
    } else {
      // Acima de dez: Dez com as unidades por cima, ou dezenas clarinhas com as unidades ao lado.
      const dezenas = Math.floor(n / 10), resto = n % 10;
      const [c, cd] = DEZENAS[dezenas];
      if (dezenas === 1) {
        cols = 2; rows = 5 + Math.ceil(resto / 2);
        for (let y = 0; y < 5; y++) for (let x = 0; x < 2; x++) add(x, y, [c, cd]);
        for (let i = 0; i < resto; i++) add(i % 2, 5 + Math.floor(i / 2), corDe(resto, resto - 1 - i));
        regiao = { cols: 2, rows: 5, topo: rows - 5 };
      } else {
        cols = dezenas + (resto ? 1 : 0); rows = 10;
        for (let y = 0; y < 10; y++) {
          for (let x = 0; x < dezenas; x++) add(x, y, [c, cd]);
          if (y < resto) add(dezenas, y, corDe(resto, resto - 1 - y));
        }
        regiao = { cols: dezenas, rows: 10, topo: 0 };
      }
    }
    return { n, cols, rows, regiao, cells };
  }

  function estiloDe(n) {
    if (n <= 10) return NB[n];
    const cor = DEZENAS[Math.floor(n / 10)][2];
    return { membro: cor, olhos: 'aro', aro: cor, labio: '#ff7f8f', contorno: cor };
  }

  /* Opções: torre, bracos, pernas, numero (true, false ou um texto como "?"), humor,
     vazios (quantos blocos do fim ficam só como contorno), cores ([c, cd] por bloco, na ordem de empilhar),
     semRosto (só os blocos, sem rosto nem membros, mantendo o espaço das pernas). */
  function create(n, opts = {}) {
    const { torre = false, bracos = true, pernas = true, numero = true, humor, vazios = 0, cores = null, semRosto = false } = opts;
    const L = layout(n, { torre });
    const estilo = estiloDe(n);
    const el = document.createElement('div');
    el.className = 'nb' + (pernas ? '' : ' sem-pernas') + (semRosto ? ' sem-rosto' : '');
    el.dataset.n = n;
    el.dataset.olhos = estilo.olhos;
    const vars = { cols: L.cols, rows: L.rows, total: L.cells.length, membro: estilo.membro, aro: estilo.aro, labio: estilo.labio,
      perna: estilo.perna, pe: estilo.pe, mao: estilo.mao, ponto: estilo.ponto, contorno: estilo.contorno,
      'mao-borda': estilo.mao ? 'calc(var(--u) * .04)' : undefined, extra: estilo.extra ? (estilo.extra === 'coroa' ? .55 : .45) : undefined };
    el.style.cssText = Object.entries(vars).filter(([, v]) => v !== undefined).map(([k, v]) => `--${k}:${v}`).join(';');

    const corpo = document.createElement('div');
    corpo.className = 'nb-corpo';
    L.cells.forEach(({ x, y, c, cd }, i) => {
      const bloco = document.createElement('i');
      const [bc, bcd] = cores && cores[i] ? cores[i] : [c, cd];
      bloco.className = 'nb-b' + (n === 6 && !cores ? ' ponto' : '') + (i >= L.cells.length - vazios ? ' vazio' : '');
      bloco.dataset.i = i;
      bloco.style.cssText = `grid-column:${x + 1};grid-row:${L.rows - y};--c:${bc};--cd:${bcd};--i:${i}`;
      corpo.appendChild(bloco);
    });

    const largura = L.regiao.cols;
    const fe = largura >= 3 ? 1.5 : largura === 2 ? 1.3 : 1;
    const regiao = document.createElement('div');
    regiao.className = 'nb-regiao';
    regiao.style.cssText = `--fw:${largura};--fr:${L.regiao.rows};--ft:${L.regiao.topo};--fe:${fe};--fh:${largura > 1 ? 1.5 : 1}`;
    const olho = estrela => `<i class="nb-olho${estrela ? ' estrela' : ''}"><b></b></i>`;
    const olhos = estilo.olhos === 'um' ? olho() : estilo.olhos === 'estrela' ? olho(true) + olho(true) : estilo.olhos === 'estrela1' ? olho(true) + olho() : olho() + olho();
    let html = estilo.contorno ? '<span class="nb-contorno"></span>' : '';
    if (estilo.extra) html += `<span class="nb-extra">${EXTRAS[estilo.extra]}</span>`;
    html += `<span class="nb-rosto" style="--pisca:${(-Math.random() * 5).toFixed(2)}s">${estilo.sobrancelhas ? '<span class="nb-sobrancelhas"><i></i><i></i></span>' : ''}` +
      `<span class="nb-olhos">${olhos}</span><i class="nb-boca ${humor || estilo.boca || 'feliz'}"></i></span>`;
    if (estilo.botoes) html += '<span class="nb-botoes"><i></i><i></i><i></i></span>';
    if (bracos) {
      const pares = estilo.bracos || 1;
      for (let k = 0; k < pares; k++) {
        const giro = pares > 1 ? [24, 52, 34][k] : 14;
        const altura = pares > 1 ? .25 + k * .95 : estilo.ombro ?? .3;
        for (const lado of ['e', 'd']) html += `<span class="nb-braco ${lado}${k === 0 ? ' topo' : ''}" style="--by:${altura};--g:${giro}deg"></span>`;
      }
    }
    if (pernas) html += '<span class="nb-perna e"></span><span class="nb-perna d"></span>';
    regiao.innerHTML = html;

    const partes = [corpo, regiao];
    if (numero !== false) {
      const etiqueta = document.createElement('span');
      etiqueta.className = 'nb-num';
      etiqueta.textContent = numero === true ? n : numero;
      partes.unshift(etiqueta);
    }
    el.append(...partes);
    return el;
  }

  /* Cor de cada bloco do personagem, na ordem de empilhar (para trocar as cores de uma soma). */
  const colors = (n, opts) => layout(n, opts).cells.map(({ c, cd }) => [c, cd]);
  const name = n => NOMES[n] || String(n);

  window.Numberblocks = Object.freeze({ create, layout, colors, name, NB });
})();
