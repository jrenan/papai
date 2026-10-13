/*
 * Exercises transcribed from Leo's speech-therapy notebook, in the notebook's
 * order. `notebook` keeps the therapist's own wording.
 */

export const CATS = {
  respiracao: { title: 'Respiração' },
  lingua: { title: 'Articulatórios', sub: 'Língua' },
  labios: { title: 'Articulatórios', sub: 'Lábios' },
  veu: { title: 'Articulatórios', sub: 'Véu palatino' },
  fazendinha: { title: 'Fazendinha', sub: 'Sons e palavras' },
  relaxar: { title: 'Bocejo' },
  jogo: { title: 'Caretas com o dinossauro' },
};

export const EXERCISES = [
  {
    id: 'respiracao', cat: 'respiracao', name: 'Cheirar a flor e soprar a vela', emoji: '🌸',
    notebook: 'CHEIRAR A FLOR · SOPRAR A VELA', reps: 5,
    kind: { type: 'breath' }, scene: 'flowerCake', camera: true, mic: true, routine: true, defaultOn: true,
    intro: 'Vamos respirar! Primeiro cheire a florzinha pelo nariz, com a boca fechada. Depois sopre a velinha bem forte!',
    hint: 'Boca fechada, puxa o ar pelo nariz. Depois sopra: fuuuu!',
  },
  {
    id: 'linguaForaDentro', cat: 'lingua', name: 'Língua para fora e para dentro', emoji: '😛',
    notebook: 'LÍNGUA PARA FORA E PARA DENTRO 10X', reps: 10,
    kind: { type: 'face', steps: [{ any: ['linguaFora'], holdMs: 300 }, { any: ['linguaDentro'], holdMs: 300 }] },
    scene: 'flies', camera: true, mic: false, routine: true, defaultOn: true,
    intro: 'O Dino está com fome de mosquinha! Põe a língua bem pra fora pra pegar, e depois guarda a língua.',
    hint: 'Abre a boca e põe a língua bem pra fora!',
  },
  {
    id: 'linguaLados', cat: 'lingua', name: 'Língua para um lado e para o outro', emoji: '👅',
    notebook: 'LÍNGUA PARA UM LADO E PARA O OUTRO 10X', reps: 10,
    kind: { type: 'face', steps: [{ any: ['linguaEsq'], holdMs: 300 }, { any: ['linguaDir'], holdMs: 300 }] },
    scene: 'chocolate', camera: true, mic: false, routine: true, defaultOn: true,
    intro: 'O Dino sujou a boca de chocolate! Limpa um cantinho com a língua, depois o outro.',
    hint: 'Leva a pontinha da língua até o cantinho da boca.',
  },
  {
    id: 'linguaCimaBaixo', cat: 'lingua', name: 'Língua para cima e para baixo', emoji: '🍯',
    notebook: 'LÍNGUA PARA CIMA E PARA BAIXO 10X', reps: 10,
    kind: { type: 'face', steps: [{ any: ['linguaCima'], holdMs: 300 }, { any: ['linguaBaixo'], holdMs: 300 }] },
    scene: 'honey', camera: true, mic: false, routine: true, defaultOn: true,
    intro: 'Tem mel em cima da boca e farelo no queixo! Língua pra cima, língua pra baixo.',
    hint: 'Abre a boca e estica a língua pra cima, até o nariz. Depois pra baixo, até o queixo.',
  },
  {
    id: 'estalar', cat: 'lingua', name: 'Estalar a língua', emoji: '🐴',
    notebook: 'ESTALAR A LÍNGUA 10X', reps: 10,
    kind: { type: 'click' }, scene: 'horse', camera: true, mic: true, routine: true, defaultOn: true,
    intro: 'Vamos fazer o barulho do cavalinho! Estala a língua: cloc, cloc!',
    hint: 'Gruda a língua no céu da boca e solta com força: cloc!',
  },
  {
    id: 'vibrarLingua', cat: 'lingua', name: 'Vibrar a língua', emoji: '🚜',
    notebook: 'VIBRAR A LÍNGUA', reps: 10,
    kind: { type: 'trill', minMs: 600, lips: 'any' }, scene: 'tractor', camera: true, mic: true, routine: true, defaultOn: true,
    intro: 'Liga o trator! Faz a língua vibrar: trrrrrr!',
    hint: 'Encosta a pontinha da língua atrás dos dentes de cima e sopra: trrrr!',
  },
  {
    id: 'sorvete', cat: 'lingua', name: 'Lamber o sorvete', emoji: '🍦',
    notebook: 'MOVIMENTO DE LAMBER O SORVETE 10X', reps: 10,
    kind: { type: 'face', steps: [{ any: ['linguaFora', 'linguaBaixo'], holdMs: 200 }, { any: ['linguaCima', 'linguaDentro'], holdMs: 150 }] },
    scene: 'icecream', camera: true, mic: false, routine: true, defaultOn: true,
    intro: 'Hum, sorvete! Põe a língua pra fora e lambe de baixo pra cima.',
    hint: 'Língua bem pra fora, e lambe pra cima!',
  },
  {
    id: 'bicoSorriso', cat: 'labios', name: 'Bico e sorriso', emoji: '😗',
    notebook: 'BICO E SORRISO 10X', reps: 10,
    kind: { type: 'face', steps: [{ any: ['bico'], holdMs: 400 }, { any: ['sorriso'], holdMs: 400 }] },
    scene: 'kisses', camera: true, mic: false, routine: true, defaultOn: true,
    intro: 'Faz um bico de beijinho, e depois um sorriso bem grande!',
    hint: 'Bico bem pra frente... agora sorriso!',
  },
  {
    id: 'beijoVovo', cat: 'labios', name: 'Beijo do vovô', emoji: '👴',
    notebook: 'BEIJO DO VOVÔ 10X', reps: 10,
    kind: { type: 'face', steps: [{ any: ['beijoVovo'], holdMs: 600 }, { not: 'beijoVovo', holdMs: 200 }] },
    scene: 'grandpa', camera: true, mic: false, routine: true, defaultOn: true,
    intro: 'O vovô Dino esconde os lábios dentro da boca! Esconde os lábios, segura, e solta.',
    hint: 'Esconde os dois lábios pra dentro, igual vovô sem dentadura!',
  },
  {
    id: 'vibrarLabios', cat: 'labios', name: 'Vibrar os lábios', emoji: '🏍️',
    notebook: 'VIBRAR OS LÁBIOS 10X · BARULHO DA MOTO', reps: 10,
    kind: { type: 'trill', minMs: 600, lips: 'closed' }, scene: 'moto', camera: true, mic: true, routine: true, defaultOn: true,
    intro: 'Vamos correr de moto! Lábios juntinhos e soltinhos: brrrrrum!',
    hint: 'Junta os lábios, deixa eles moles e sopra: brrrrr!',
  },
  {
    id: 'rato', cat: 'veu', name: 'Barulho do R do rato', emoji: '🐭',
    notebook: 'BARULHO DO "R" DO RATO · RRRRRR!!', reps: 5,
    kind: { type: 'sound', minMs: 900 }, scene: 'mouse', camera: true, mic: true, routine: true, defaultOn: true,
    intro: 'O ratinho quer o queijo! Faz o barulho do R bem comprido: rrrrrrr!',
    hint: 'Faz rrrrrr lá no fundo da garganta, bem comprido!',
  },
  {
    id: 'trava', cat: 'veu', name: 'O rato roeu a roupa do rei de Roma', emoji: '👑',
    notebook: '"O RATO ROEU A ROUPA DO REI DE ROMA."', reps: 3,
    kind: { type: 'phrase', text: 'O rato roeu a roupa do rei de Roma', minMs: 1300 },
    scene: 'king', camera: true, mic: true, routine: true, defaultOn: true,
    intro: 'Agora o trava-língua! Escuta e fala comigo: O rato roeu a roupa do rei de Roma.',
    hint: 'Devagarinho: O rato... roeu... a roupa... do rei... de Roma.',
  },
  {
    id: 'gargarejo', cat: 'veu', name: 'Gargarejo', emoji: '🥛',
    notebook: 'VÉU PALATINO: BARULHO DO GARGAREJO · GRR GRR', reps: 3,
    kind: { type: 'sound', minMs: 1200 }, scene: 'gargle', camera: false, mic: true, routine: true, defaultOn: false,
    intro: 'Pega um copinho de água e um golinho na boca. Olha pra cima e faz: grrrrr! Depois cospe na pia.',
    hint: 'Cabeça pra trás e grrrrr!',
  },
  {
    id: 'vaca', cat: 'fazendinha', name: 'Vaca', emoji: '🐄', notebook: 'VACA · MUUUU!', reps: 9,
    kind: { type: 'animal', animal: 'vaca' }, scene: 'farm', camera: true, mic: true, routine: true, defaultOn: true,
    intro: 'A vaca faz muuuu! Vamos falar palavras que começam com MU.',
    hint: 'Junta os lábios: mmmm... e fala!',
  },
  {
    id: 'gato', cat: 'fazendinha', name: 'Gato', emoji: '🐱', notebook: 'GATO · MIAUUU!!!', reps: 9,
    kind: { type: 'animal', animal: 'gato' }, scene: 'farm', camera: true, mic: true, routine: true, defaultOn: true,
    intro: 'O gato faz miau! Vamos falar palavras que começam com MI.',
    hint: 'Junta os lábios: mmmm... e fala!',
  },
  {
    id: 'pinto', cat: 'fazendinha', name: 'Pinto', emoji: '🐤', notebook: 'PINTO · PIU! PIU!', reps: 9,
    kind: { type: 'animal', animal: 'pinto' }, scene: 'farm', camera: true, mic: true, routine: true, defaultOn: true,
    intro: 'O pintinho faz piu piu! Vamos falar palavras com P.',
    hint: 'Fecha os lábios e solta o ar: P!',
  },
  {
    id: 'galinha', cat: 'fazendinha', name: 'Galinha', emoji: '🐔', notebook: 'GALINHA · COCÓ!', reps: 9,
    kind: { type: 'animal', animal: 'galinha' }, scene: 'farm', camera: true, mic: true, routine: true, defaultOn: true,
    intro: 'A galinha faz cocó! Vamos falar palavras que começam com CO.',
    hint: 'Fala bem forte: CO!',
  },
  {
    id: 'bochechas', cat: 'labios', name: 'Bochechas de balão', emoji: '🎈',
    notebook: 'CARETAS COM O DINOSSAURO · ENCHER AS BOCHECHAS', reps: 10,
    kind: { type: 'face', steps: [{ any: ['bochechas'], holdMs: 700 }, { not: 'bochechas', holdMs: 200 }] },
    scene: 'balloon', camera: true, mic: false, routine: true, defaultOn: true,
    intro: 'Enche as bochechas de ar, igual um balão! Segura... e solta.',
    hint: 'Boca fechada e enche as bochechas!',
  },
  {
    id: 'bocejo', cat: 'relaxar', name: 'Bocejo', emoji: '🥱',
    notebook: 'BOCEJAR QUANDO TERMINAR OS EXERCÍCIOS PARA RELAXAR A MUSCULATURA TRABALHADA. 1X', reps: 1,
    kind: { type: 'face', steps: [{ any: ['bocejo'], holdMs: 1500 }] },
    scene: 'night', camera: true, mic: false, routine: true, defaultOn: true,
    intro: 'Terminamos! Agora um bocejo bem grande pra relaxar a boca.',
    hint: 'Abre a boca bem grande, aaaaah!',
  },
  {
    id: 'caretas', cat: 'jogo', name: 'Caretas com o Dino', emoji: '🦕',
    notebook: 'CARETAS COM O DINOSSAURO', reps: 10,
    kind: { type: 'simon' }, scene: 'simon', camera: true, mic: false, routine: false, defaultOn: false,
    intro: 'Eu faço uma careta e você copia! Preparado?',
    hint: 'Olha a careta do Dino e faz igual!',
  },
];

export const EX = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export const ANIMALS = {
  vaca: {
    emoji: '🐄', sound: 'MUUU!', say: 'Muuuuu', check: 'mu',
    words: [
      { w: 'MURO', e: '🧱' }, { w: 'MULA', e: '🫏' }, { w: 'MUSA' }, { w: 'MUSEU', e: '🏛️' }, { w: 'MUNDO', e: '🌎' },
      { w: 'MÚSICA', e: '🎵' }, { w: 'MÚMIA' }, { w: 'MUITO' }, { w: 'MUDAR', e: '📦' }, { w: 'MULATO' }, { w: 'MUGIR', e: '🐄' },
      { w: 'MUSICAL', e: '🎶' }, { w: 'MULHER', e: '👩' }, { w: 'MULATA' }, { w: 'MUDO', e: '🤐' }, { w: 'MURALHA', e: '🏯' },
      { w: 'MUNICIPAL', e: '🏛️' }, { w: 'MUXA' }, { w: 'MURICI' }, { w: 'MURAR', e: '🧱' }, { w: 'MUÇÁ' }, { w: 'MUSICOTERAPIA', e: '🎼' },
    ],
  },
  gato: {
    emoji: '🐱', sound: 'MIAU!', say: 'Miaaaau', check: 'mi',
    words: [
      { w: 'MILHO', e: '🌽' }, { w: 'MINHOCA', e: '🪱' }, { w: 'MINGAU', e: '🥣' }, { w: 'MICO', e: '🐒' }, { w: 'MIOLO', e: '🍞' },
      { w: 'MICRO', e: '🔬' }, { w: 'MIMO', e: '🎁' }, { w: 'MINA', e: '⛏️' }, { w: 'MIRA', e: '🎯' }, { w: 'MIRIM', e: '👦' },
      { w: 'MISSA', e: '⛪' }, { w: 'MIMOSO', e: '🥰' }, { w: 'MISTÉRIO', e: '🕵️' }, { w: 'MILAGRE', e: '✨' }, { w: 'MISSÃO', e: '🚀' },
      { w: 'MISTER', e: '🎩' }, { w: 'MIGALHA', e: '🍪' }, { w: 'MINUTA', e: '📝' }, { w: 'MISTURA', e: '🥄' }, { w: 'MINI', e: '🤏' },
    ],
  },
  pinto: {
    emoji: '🐤', sound: 'PIU! PIU!', say: 'Piu, piu', check: 'pi',
    words: [
      { w: 'PAPAI', e: '👨' }, { w: 'PIPA', e: '🪁' }, { w: 'PATO', e: '🦆' }, { w: 'PEIXE', e: '🐟' }, { w: 'PINTO', e: '🐤' },
      { w: 'PARAFUSO', e: '🔩' }, { w: 'POMBO', e: '🕊️' }, { w: 'PIOLHO' }, { w: 'PANELA', e: '🍲' }, { w: 'PIA', e: '🚰' }, { w: 'PONTE', e: '🌉' },
    ],
  },
  galinha: {
    emoji: '🐔', sound: 'COCÓ!', say: 'Có, có, có', check: 'co',
    words: [
      { w: 'COLO', e: '🤱' }, { w: 'COLAR', e: '📿' }, { w: 'COLA', e: '🧴' }, { w: 'COCAR', e: '🪶' }, { w: 'CORAÇÃO', e: '❤️' },
      { w: 'COPA', e: '🏆' }, { w: 'COCO', e: '🥥' }, { w: 'COPO', e: '🥤' }, { w: 'COELHO', e: '🐰' }, { w: 'COLÍRIO', e: '💧' },
      { w: 'COCÔ', e: '💩' }, { w: 'COMIDA', e: '🍽️' },
    ],
  },
};

/** Big label + emoji for the instruction pill. Left/right are as seen in the mirror. */
export const POSE_LABEL = {
  bico: { t: 'BICO', e: '😗' },
  bicoAberto: { t: 'BICO ABERTO', e: '😮' },
  sorriso: { t: 'SORRISO', e: '😁' },
  beijoVovo: { t: 'BEIJO DO VOVÔ', e: '👴' },
  bochechas: { t: 'BOCHECHAS CHEIAS', e: '🐡' },
  bocaAberta: { t: 'BOCA ABERTA', e: '😮' },
  bocaFechada: { t: 'BOCA FECHADA', e: '😌' },
  bocejo: { t: 'BOCEJO GRANDE', e: '🥱' },
  linguaFora: { t: 'LÍNGUA PRA FORA', e: '😛' },
  linguaDentro: { t: 'GUARDA A LÍNGUA', e: '🙂' },
  linguaEsq: { t: 'LÍNGUA ⬅ AQUI', e: '👅' },
  linguaDir: { t: 'AQUI ➡ LÍNGUA', e: '👅' },
  linguaCima: { t: 'LÍNGUA PRA CIMA', e: '⬆️' },
  linguaBaixo: { t: 'LÍNGUA PRA BAIXO', e: '⬇️' },
  balaEsq: { t: 'BALA NA BOCHECHA ⬅', e: '🍬' },
  balaDir: { t: 'BALA NA BOCHECHA ➡', e: '🍬' },
};

/** Spoken name of each face (used by the "Caretas" game and step prompts). */
export const POSE_SAY = {
  bico: 'Bico!', bicoAberto: 'Bico aberto!', sorriso: 'Sorriso!', beijoVovo: 'Beijo do vovô!',
  bochechas: 'Bochechas cheias!', bocaAberta: 'Boca aberta!', bocaFechada: 'Boca fechada!', bocejo: 'Bocejo!',
  linguaFora: 'Língua pra fora!', linguaDentro: 'Guarda a língua!', linguaEsq: 'Língua pro lado!', linguaDir: 'Língua pro outro lado!',
  linguaCima: 'Língua pra cima!', linguaBaixo: 'Língua pra baixo!', balaEsq: 'Bala na bochecha!', balaDir: 'Bala na outra bochecha!',
};

export const SIMON_POOL = ['bico', 'sorriso', 'bochechas', 'beijoVovo', 'bocaAberta', 'bicoAberto', 'linguaFora', 'linguaEsq', 'linguaDir', 'linguaCima'];

export const STICKERS = ['🦕', '🦖', '🐢', '🐊', '🦎', '🐸', '🐙', '🦄', '🐳', '🦋', '🐞', '🌈', '⭐', '🚀', '🎈', '🍉', '🍦', '🦁', '🐼', '🐨', '🦊', '🐧', '🦜', '🐬', '🌻', '🍄', '🧩', '⚽', '🚂', '🛸', '🐝', '🦒', '🐘', '🦩', '🍓', '🎸'];

export const DINO_FRIENDS = [
  { e: '🦕', name: 'Pescoçudo' }, { e: '🦖', name: 'Rex' }, { e: '🐢', name: 'Casquinha' }, { e: '🐊', name: 'Dentuço' },
  { e: '🦎', name: 'Lagartixo' }, { e: '🐉', name: 'Fogo' }, { e: '🐲', name: 'Dragãozinho' }, { e: '🦤', name: 'Dodô' },
];
