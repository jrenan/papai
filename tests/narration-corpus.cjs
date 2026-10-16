'use strict';

const assert = require('node:assert/strict');
const vm = require('node:vm');
const { ROOT, read, normalize, compositionKey, sourceFunction, buildCorpus, serialize } = require('../scripts/export-narration.cjs');
const corpus = buildCorpus();
assert.equal(read('assets/narration-script.json'), serialize(corpus), 'Regenerate the corpus after narrated text changes');
assert.equal(corpus.voice.id, 'cgSgspJ2msm6clMCkdW9');
assert.equal(corpus.modelID, 'eleven_v4');
assert.ok(corpus.clips.length > 500);
assert.ok(corpus.clips.every(c => !c.sources.some(s => /fono|dinofala/i.test(s))));
assert.equal(new Set(corpus.clips.map(c => c.id)).size, corpus.clips.length);
assert.equal(new Set(corpus.clips.map(c => c.text)).size, corpus.clips.length);
for (const clip of corpus.clips) {
  assert.match(clip.file, /^n-[a-f0-9]{24}\.mp3$/u);
  assert.equal(clip.text, normalize(clip.text));
}

// This independent word trie verifies that compositions cover every word in
// order. Missing words fail, even when the rest of the sentence has audio.
const trie = new Map();
for (const clip of corpus.clips) {
  let node = trie;
  for (const word of compositionKey(clip.text).split(' ')) {
    if (!node.has(word)) node.set(word, new Map());
    node = node.get(word);
  }
  node.set('', true);
}
const coverageCache = new Map();
let checked = 0;
function covered(text) {
  const key = compositionKey(text);
  if (coverageCache.has(key)) return coverageCache.get(key);
  const words = key.split(' '), reachable = new Set([0]);
  for (let start = 0; start < words.length; start++) {
    if (!reachable.has(start)) continue;
    let node = trie;
    for (let end = start; end < words.length; end++) {
      node = node.get(words[end]);
      if (!node) break;
      if (node.has('')) reachable.add(end + 1);
    }
  }
  const result = reachable.has(words.length);
  coverageCache.set(key, result);
  return result;
}
function check(text) {
  checked++;
  assert.ok(covered(text), `No complete narration coverage for: ${text}`);
}
assert.equal(covered('Quanto é vinte mais cinco? Toque na resposta certa.'), true);
assert.equal(covered('Quanto é vinte palavra inexistente mais cinco?'), false);

const blocks = read('numberblocks-1-100/blocos-de-somar.html');
const numberSection = blocks.match(/\/\* ---------- números por extenso ---------- \*\/([^]*?)\/\* ---------- níveis ---------- \*\//u)[1];
const numbers = vm.runInNewContext(`${numberSection}; ({ext,dzF,unF,decF})`);
const { ext, dzF, unF } = numbers;
const literalCall = /\bsay\((('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`))\)/gu;

// Literal/template calls are read from the shipped source, not copied from the
// corpus. Enumerate the actual finite arithmetic domain for each variable.
const blockExpressions = [...blocks.matchAll(literalCall)].map(m => new vm.Script(m[1]));
assert.equal(blockExpressions.length, 14, 'Review narration inventory when say() call sites change');
for (let a = 1; a <= 99; a++) {
  for (let b = 1; a + b <= 100; b++) {
    const ctx = vm.createContext({ ...numbers, S: { a, b, ans: { t: Math.floor((a+b)/10), u: (a+b)%10 } }, n: a, c: a+b, J: { tens: Array(Math.floor((a+b)/10)), ones: Array((a+b)%10) } });
    for (const expression of blockExpressions) check(expression.runInContext(ctx));
  }
}
// Branches with assigned speech / ternary values are separate from direct
// literal say() calls. This covers empty, wrong total, bars, units and count.
for (let n = 0; n <= 100; n++) {
  for (let total = 0; total <= 109; total++) check(`Você montou ${ext(total)}. O número é ${ext(n)}. Tente de novo!`);
  check(`${ext(n)} não tem dezenas. Tire as barras.`);
  check(`Faltam barras. ${ext(n)} tem ${dzF(Math.floor(n/10))}.`);
  check(`Tem barras demais. ${ext(n)} tem ${dzF(Math.floor(n/10))}.`);
  check(`Faltam cubinhos. ${ext(n)} tem ${unF(n%10)}.`);
  check(`Tem cubinhos demais. ${ext(n)} tem ${unF(n%10)}.`);
}
check('O quadro está vazio. Arraste as peças para ele.');
for (const prefix of ['Muito bem! Dez unidades viraram uma dezena!', 'Tudo junto!']) check(prefix + ' Agora conte. Quantas dezenas? E quantas unidades?');
for (let t = 0; t <= 10; t++) check(`Isso! ${dzF(t)}. E quantas unidades?`);
for (let u = 0; u <= 19; u++) check(`Isso! ${unF(u)}. E quantas dezenas?`);
check('Ainda não. Conte as barras de dez.');
check('Ainda não. Conte os cubinhos soltos.');
for (let n = 0; n <= 110; n++) check(ext(n));

const join = read('numberblocks-somar/index.html');
const joinNumbers = join.match(/\/\* ---------- números ---------- \*\/([^]*?)\/\* cor do cartão/u)[1];
const names = read('numberblocks-somar/numberblocks.js').match(/const NOMES = (\[[^]*?\]);/u)[1];
const NBK = vm.runInNewContext(`const names=${names}; ({name:n=>names[n] || String(n)})`);
const joinContext = vm.createContext({ NBK });
const joinVocabulary = vm.runInContext(`${joinNumbers}; ({ext,nome})`, joinContext);
const joinExpressions = [...join.matchAll(literalCall)].map(m => new vm.Script(m[1]));
assert.equal(joinExpressions.length, 8, 'Review narration inventory when join say() call sites change');
for (let a = 1; a <= 10; a++) {
  for (let b = 1; b <= 10 && a+b <= 20; b++) {
    for (let v = 1; v <= 20; v++) {
      const ctx = vm.createContext({ ...joinVocabulary, S: { a, b }, n: a+b, c: a+b, v });
      for (const expression of joinExpressions) check(expression.runInContext(ctx));
    }
    const { nome } = joinVocabulary;
    check(a === b ? `Arraste um ${nome(a)} até o outro para eles se juntarem!` : `Arraste o ${nome(b)} até o ${nome(a)} para eles se juntarem!`);
  }
}

// Compute country speech through the actual app normalization functions. This
// catches fallback changes without trusting the exporter's mirrored algorithm.
const app = read('app.js');
const countryContext = vm.createContext({ Intl });
vm.runInContext(read('country-content.js') + '\n' + read('world-data.js'), countryContext);
const countryFunctions = ['formatNumber', 'formatPopulation', 'formatArea', 'listObjectValues', 'colorFromId',
  'slugCountryName', 'getPopulationForCountry', 'normalizeRestCountry', 'normalizeFallbackCountry'];
const actualCountries = vm.runInContext(`${countryFunctions.map(name => sourceFunction(app, name)).join('\n')};
  ({normalizeRestCountry,normalizeFallbackCountry,WORLD_DATA})`, countryContext);
const countries = JSON.parse(read('data/world-countries.json'));
assert.equal(countries.length, 250);
for (const country of countries) {
  const actual = actualCountries.normalizeRestCountry(country);
  check(`${actual.name}. ${actual.music}`);
}
for (const country of actualCountries.WORLD_DATA.countries) {
  const actual = actualCountries.normalizeFallbackCountry(country);
  check(`${actual.name}. ${actual.music}`);
}

const biomeContext = vm.createContext({ Intl });
vm.runInContext(read('game-data.js') + '\nconst {traits,species,habitats} = GAME_DATA;', biomeContext);
const biomeNames = ['getTrait', 'getHabitatTraitIds', 'getMatchingTraitIds', 'getMissingTraitIds',
  'getCompatibilityLevel', 'formatTraitNames', 'withArticle', 'capitalize', 'habitatWhere', 'buildFeedbackText'];
const biomeDefinitions = app.match(/^const feedbackByLevel = \{[^]*?^};/m)[0];
const actualBiomes = vm.runInContext(`const traitList = new Intl.ListFormat('pt-BR', {style:'long',type:'conjunction'});
  ${biomeDefinitions}\n${biomeNames.map(name => sourceFunction(app, name)).join('\n')};
  ({GAME_DATA,withArticle,getCompatibilityLevel,buildFeedbackText,feedbackByLevel})`, biomeContext);
for (const mission of actualBiomes.GAME_DATA.missions) {
  const living = actualBiomes.GAME_DATA.species[mission.species];
  const named = actualBiomes.withArticle(living);
  check(`Ajude ${named}. ${mission.story || living.story} Toque nas fotos para ver as pistas e arraste ${named} até o lugar certo no mapa do Brasil.`);
  for (const habitatID of Object.keys(actualBiomes.GAME_DATA.habitats)) {
    const level = actualBiomes.getCompatibilityLevel(mission.species, habitatID);
    const feedback = `${actualBiomes.feedbackByLevel[level].title} ${actualBiomes.buildFeedbackText(mission.species, habitatID, level)}`;
    check(feedback + (level === 'good' ? ` ${living.adaptation.question}` : ''));
  }
  check(`Investigue mais um pouquinho. Olhe para o corpo ${living.article === 'a' ? 'da' : 'do'} ${living.name} e para as pistas do lugar. ${living.adaptation.question}`);
  check(`Descoberta guardada! Isso! ${living.adaptation.explanation}`);
}
console.log(`PASS narration corpus: ${corpus.clips.length} clips; ${checked} utterances / ${coverageCache.size} distinct compositions; all 250 countries; no retired DinoFala content`);
