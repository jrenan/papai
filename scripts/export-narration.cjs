#!/usr/bin/env node
'use strict';

// Export only the four web games. DinoFala / the retired fono-do-leo are not inputs.
// No API key or remote service is needed to produce this deterministic corpus.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const normalize = text => String(text).normalize('NFC').replace(/\s+/gu, ' ').trim();
const compositionKey = text => normalize(text).toLocaleLowerCase('pt-BR').replace(/[.!?,:;]/gu, ' ').replace(/\s+/gu, ' ').trim();

function data(file, names) {
  const context = vm.createContext({});
  return vm.runInContext(`${read(file)}; ({${names.join(',')}})`, context);
}

// Source functions are executed unchanged, making curated data and feedback the
// source of truth. These are top-level functions whose closing brace starts a line.
function sourceFunction(source, name) {
  const match = source.match(new RegExp(`^function ${name}\\([^]*?^}`, 'm'));
  if (!match) throw new Error(`Cannot export source function ${name}`);
  return match[0];
}

function buildCorpus() {
  const byText = new Map();
  const add = (text, source) => {
    text = normalize(text);
    if (!text) throw new Error(`Empty narration in ${source}`);
    const old = byText.get(text);
    if (old) {
      if (!old.sources.includes(source)) old.sources.push(source);
      return;
    }
    const id = `n-${crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24)}`;
    byText.set(text, { id, text, file: `${id}.mp3`, sources: [source] });
  };

  const { GAME_DATA } = data('game-data.js', ['GAME_DATA']);
  const source = read('app.js');
  const pureNames = ['getTrait', 'getHabitatTraitIds', 'getMatchingTraitIds', 'getMissingTraitIds',
    'getCompatibilityLevel', 'formatTraitNames', 'withArticle', 'capitalize', 'habitatWhere', 'buildFeedbackText'];
  const feedback = source.match(/^const feedbackByLevel = \{[^]*?^};/m)?.[0];
  if (!feedback) throw new Error('Cannot export biome feedback definitions');
  const context = vm.createContext({ GAME_DATA, Intl });
  const biome = vm.runInContext(`const {traits,species,habitats} = GAME_DATA;
    const traitList = new Intl.ListFormat('pt-BR', {style:'long',type:'conjunction'});
    ${feedback}\n${pureNames.map(name => sourceFunction(source, name)).join('\n')}
    ({getCompatibilityLevel,withArticle,buildFeedbackText,feedbackByLevel})`, context);

  for (const mission of GAME_DATA.missions) {
    const living = GAME_DATA.species[mission.species];
    const named = biome.withArticle(living);
    add(`Ajude ${named}. ${mission.story || living.story} Toque nas fotos para ver as pistas e arraste ${named} até o lugar certo no mapa do Brasil.`, `biomes:${mission.species}:prompt`);
    for (const habitatID of Object.keys(GAME_DATA.habitats)) {
      const level = biome.getCompatibilityLevel(mission.species, habitatID);
      // A good placement also opens the unanswered body-adaptation question.
      add(biome.feedbackByLevel[level].title, `biomes:${mission.species}:${habitatID}:feedback-title`);
      add(biome.buildFeedbackText(mission.species, habitatID, level), `biomes:${mission.species}:${habitatID}:feedback`);
      if (level === 'good') add(living.adaptation.question, `biomes:${mission.species}:adaptation:question`);
    }
    add('Investigue mais um pouquinho.', 'biomes:adaptation:retry-title');
    add(`Olhe para o corpo ${living.article === 'a' ? 'da' : 'do'} ${living.name} e para as pistas do lugar.`, `biomes:${mission.species}:adaptation:retry`);
    add('Descoberta guardada! Isso!', 'biomes:adaptation:success-title');
    add(living.adaptation.explanation, `biomes:${mission.species}:adaptation:success`);
  }

  const { COUNTRY_CONTENT } = data('country-content.js', ['COUNTRY_CONTENT']);
  const countries = JSON.parse(read('data/world-countries.json'));
  for (const country of countries) {
    // Mirrors normalizeRestCountry, including the language fallback for every
    // entry in the shipped offline country dataset, not just curated countries.
    const name = country.translations?.por?.common || country.name?.native?.por?.common || country.name?.common || country.name?.official || 'Pais sem nome';
    const id = (country.cca3 || country.cca2 || name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).toLowerCase();
    const languages = Object.values(country.languages || {}).filter(Boolean).slice(0, 4);
    const music = COUNTRY_CONTENT[id]?.music || (languages.length
      ? `Neste país, muitas pessoas falam ${languages.slice(0, 2).join(' e ')}. Vamos procurar músicas cantadas nesses idiomas.`
      : 'Vamos procurar músicas, danças e sons tradicionais deste país.');
    add(`${name}.`, `world:${id}:name`);
    if (COUNTRY_CONTENT[id]?.music || !languages.length) {
      add(music, `world:${id}:music`);
    } else {
      add(`Neste país, muitas pessoas falam ${languages.slice(0, 2).join(' e ')}.`, `world:${id}:music-language`);
      add('Vamos procurar músicas cantadas nesses idiomas.', 'world:music-language:continuation');
    }
  }
  const { WORLD_DATA } = data('world-data.js', ['WORLD_DATA']);
  for (const country of WORLD_DATA.countries) {
    add(`${country.name}.`, `world-fallback:${country.id}:name`);
    add(country.music, `world-fallback:${country.id}:music`);
  }

  const blocksHTML = read('numberblocks-1-100/blocos-de-somar.html');
  const numbers = blocksHTML.match(/\/\* ---------- números por extenso ---------- \*\/([^]*?)\/\* ---------- níveis ---------- \*\//u)?.[1];
  if (!numbers) throw new Error('Cannot export number vocabulary');
  const numeric = vm.runInContext(`${numbers}; ({ext,dzF,unF,decF})`, vm.createContext({}));
  // Includes the entire displayed distractor range (0...110), plus every
  // possible build total (up to 10 bars and 9 loose cubes = 109).
  for (let n = 0; n <= 110; n++) {
    add(numeric.ext(n), `blocks:number:${n}`);
    if (n <= 19) add(numeric.ext(n, true), `blocks:number-feminine:${n}`);
  }
  for (let n = 0; n <= 10; n++) add(numeric.dzF(n), `blocks:tens:${n}`);
  for (let n = 0; n <= 19; n++) add(numeric.unF(n), `blocks:units:${n}`);

  // Compose variable arithmetic from complete vocabulary without manufacturing
  // thousands of combinations. Every word must be covered by the player; it
  // refuses a request with an unknown word instead of silently dropping it.
  const fragments = [
    'Monte o número', 'Arraste as barras de dez e os cubinhos para o quadro.',
    'Agora monte o número', 'Quanto é', 'mais', 'Toque na resposta certa.',
    'Muito bem!', 'é', 'Você montou', 'O número é', 'Tente de novo!',
    'não tem dezenas. Tire as barras.', 'Faltam barras.', 'tem', 'Tem barras demais.',
    'Faltam cubinhos.', 'Tem cubinhos demais.', 'e',
    'Agora vamos fazer a conta!', 'Isso!', 'E quantas unidades?', 'E quantas dezenas?',
    'é igual a', 'Ainda não. Olhe o quadro:',
    'Vamos montar o', 'Toque no bloco ou arraste até a sombra.', 'Agora monte o',
    'Quantos blocos? Toque no número certo.', 'Eu sou o',
    'Arraste um', 'até o outro para eles se juntarem!', 'Arraste o', 'até o', 'para eles se juntarem!',
    'não é. Olhe o último número que contamos.',
  ];
  for (const text of fragments) add(text, 'arithmetic:composition');
  const staticSpoken = [
    'Agora vamos juntar! Passe as peças de um quadro para o outro, até ficar tudo num quadro só.',
    'Não cabe mais nenhuma barra.', 'Dez unidades formam uma dezena!',
    'O quadro está vazio. Arraste as peças para ele.',
    'A casa das unidades encheu! Dez unidades formam uma dezena. Arraste a coluna cheia para a casa das dezenas.',
    'Muito bem! Dez unidades viraram uma dezena! Agora conte. Quantas dezenas? E quantas unidades?',
    'Tudo junto! Agora conte. Quantas dezenas? E quantas unidades?',
    'Muito bem! Dez unidades viraram uma dezena!',
    'Ainda não. Conte as barras de dez.', 'Ainda não. Conte os cubinhos soltos.',
    'Arraste a coluna cheia para a casa das dezenas.',
    'Vamos brincar de somar? Arraste os blocos com calma. Você pode ouvir de novo quando quiser.',
    'Juntos! Agora toque em cada bloco para contar.',
    'Vamos juntar os amigos e contar os blocos? Você pode ouvir de novo quando quiser.',
  ];
  for (const text of staticSpoken) add(text, 'arithmetic:static');

  const clips = [...byText.values()].sort((a, b) => a.id.localeCompare(b.id));
  const seen = new Set();
  for (const clip of clips) {
    if (seen.has(clip.id)) throw new Error(`Hash collision: ${clip.id}`);
    seen.add(clip.id);
    clip.sources.sort();
  }
  return {
    schemaVersion: 1,
    version: 1,
    locale: 'pt-BR',
    provider: 'ElevenLabs',
    modelID: 'eleven_v4',
    voice: { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica' },
    voiceID: 'cgSgspJ2msm6clMCkdW9',
    voiceName: 'Jessica',
    normalization: 'NFC + whitespace collapse + trim; composition also lowercases pt-BR and ignores .!?,:; separators',
    excludes: ['DinoFala', 'fono-do-leo'],
    clips,
  };
}

function serialize(corpus) { return JSON.stringify(corpus, null, 2) + '\n'; }
if (require.main === module) {
  const output = path.join(ROOT, 'assets/narration-script.json');
  const corpus = buildCorpus();
  const serialized = serialize(corpus);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== serialized) {
      console.error('Narration script is stale. Run node scripts/export-narration.cjs.');
      process.exitCode = 1;
    }
  } else {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, serialized);
  }
  console.log(JSON.stringify({ clips: corpus.clips.length, characters: corpus.clips.reduce((n, c) => n + c.text.length, 0), output: 'assets/narration-script.json' }));
}
module.exports = { ROOT, read, normalize, compositionKey, sourceFunction, buildCorpus, serialize };
