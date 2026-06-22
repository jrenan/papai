# Trio do Saber - Jogos Infantis

Tela inicial de jogos infantis em HTML, CSS e JavaScript puro. O projeto reúne
o jogo dos biomas e a primeira versão do jogo **Viagem pelo Mundo**.

## Como abrir

Rode um servidor estático local:

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

Abrir `index.html` diretamente pode bloquear os arquivos JSON locais em alguns
navegadores.

## Publicar no GitHub Pages

Este projeto funciona no GitHub Pages porque é um site estático. O Pages também
serve por HTTPS, que é necessário para o modo WebXR/VR em navegadores
compatíveis.

Depois de criar o repositório no GitHub:

```bash
git remote add origin https://github.com/SEU_USUARIO/papai.git
git branch -M main
git push -u origin main
```

No GitHub, abra **Settings > Pages** e escolha:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

O modo VR depende do navegador e do óculos anunciarem suporte a `immersive-vr`.
Em navegadores sem esse suporte, o botão VR aparece desativado.

## O que está implementado

### Tela Inicial

- Tela inicial com a marca **Trio do Saber** e seletor de jogos.
- Estrutura pronta para adicionar novas aventuras sem refazer a navegação.
- Botões de retorno ao início em cada jogo.

### Viagem pelo Mundo

- Globo terrestre 3D com Three.js, rotação lenta e controle de pausa.
- Controles para girar, aproximar, afastar e recentralizar o globo.
- Modo WebXR/VR para óculos compatíveis, com o globo como objeto 3D no espaço,
  seleção por controle, arrasto do globo e painel 3D com informações completas
  do país escolhido.
- Simulação visual de Sol e ciclo dia/noite.
- Geografia real importada por GeoJSON, com polígonos de países.
- Primeira visualização em tela cheia, focada no globo.
- Clique direto nos países do globo usando os polígonos reais.
- Detalhes do país em overlay.
- Lista pesquisável com 250 países como painel opcional.
- Bandeiras/atalhos do globo como opção separada.
- Ficha com população, capital, bandeira, principais exportações, área,
  idiomas, moedas e resumo rápido em linguagem infantil.
- Preview por iframe do Google Maps e botão separado para abrir Street View no
  Google Maps quando há coordenadas do ponto.

Dados locais usados pelo jogo de países:

- `data/world-countries.json`: países, códigos ISO, capitais, moedas, idiomas,
  áreas e coordenadas centrais.
- `data/country-by-population.json`: população por país.
- `data/countries.geojson`: GeoJSON original de fronteiras.
- `data/countries-lite.geojson`: versão simplificada para renderizar no globo.
- `world-data.js`: fallback pequeno caso os arquivos principais falhem.
- `country-content.js`: curadoria manual inicial com descrições infantis e
  pontos de interesse reais para países selecionados.

### Guardiões dos Biomas

- 6 ambientes: Pantanal, Caatinga, Mata Atlântica, Cerrado, Amazônia e Pampa.
- Tela inicial com mapa estilizado do Brasil e regiões de biomas clicáveis.
- Painel com historinha, imagem e pistas principais de cada bioma.
- 6 missões com tuiuiú, mandacaru, mico-leão-dourado, lobo-guará, boto-cor-de-rosa e ema.
- Exploração de 3 lugares por missão antes da escolha final.
- Pistas escondidas que aparecem quando a criança investiga cada lugar.
- Cálculo automático de compatibilidade usando características compartilhadas.
- Feedback por adequação: combina muito, combina um pouco e combina pouco.
- Pergunta de adaptação depois da melhor escolha.
- Botão de narração usando `speechSynthesis` do navegador.

## Como adicionar conteúdo aos biomas

Toda a configuração editável fica em `game-data.js`.

As informações da tela inicial ficam dentro de cada item de `habitats`, no campo `map`.

### 1. Adicionar uma característica

Inclua uma chave em `traits`:

```js
folhas_grandes: ["🍃", "folhas grandes"],
```

### 2. Adicionar um bioma ou ambiente

Inclua uma chave em `habitats`:

```js
brejo: {
  name: "Brejo de altitude",
  image: "assets/bioma-brejo.png",
  map: {
    label: "Brejo",
    color: "#4aa7d8",
    position: { left: "50%", top: "50%" },
    short: "Um lugar úmido com árvores, água e muitos sons.",
    story: "Depois da chuva, o brejo fica cheio de vida...",
    facts: ["muita água", "árvores", "insetos"],
  },
  traits: ["muita_agua", "arvores", "frutos"],
  aliases: ["abrigo"],
},
```

`traits` aparecem como pistas visíveis. `aliases` também contam na compatibilidade, mas não aparecem como pista principal.

### 3. Adicionar uma espécie

Inclua uma chave em `species`:

```js
sapo: {
  name: "Sapo-cururu",
  image: "assets/especie-sapo.png",
  needs: ["muita_agua", "insetos", "abrigo"],
  preferredHabitats: ["brejo"],
  story: "O sapo-cururu procura um lugar úmido, com insetos e abrigo.",
  adaptation: {
    question: "O que ajuda o sapo a viver em lugares úmidos?",
    answer: "pele úmida",
    options: ["pele úmida", "penas longas", "caule que guarda água"],
    explanation: "A pele úmida ajuda o sapo em ambientes com água.",
  },
},
```

### 4. Criar uma missão

Inclua a missão em `missions`:

```js
{ species: "sapo", habitats: ["brejo", "caatinga", "pampa"] },
```

O jogo calcula sozinho:

- `good`: quando o habitat está em `preferredHabitats` e compartilha características.
- `ok`: quando compartilha algumas características, mas não é habitat preferido.
- `low`: quando quase nada combina.

## Asset gerado

Os assets em `assets/` foram gerados com a ferramenta integrada de imagem do Codex:

- `guardioes-hero.png`: arte principal.
- `trio-do-saber.png`: arte da marca usada na tela inicial.
- `bioma-pantanal.png`, `bioma-caatinga.png`, `bioma-mata-atlantica.png`, `bioma-cerrado.png`, `bioma-amazonia.png`, `bioma-pampa.png`: cenários neutros da missão.
- `especie-tuiuiu.png`, `especie-mandacaru.png`, `especie-mico.png`, `especie-lobo-guara.png`, `especie-boto.png`, `especie-ema.png`: cartas das espécies.

## Mapa do Brasil

O contorno real do Brasil foi baixado como GeoJSON em `data/brazil-boundary.geojson` a partir do projeto público `world.geo.json` e convertido para o path SVG usado na tela inicial. O path convertido fica em `data/brazil-boundary-path.txt`.

As regiões dos biomas usam o shapefile público do IBGE `Biomas_5000mil.zip`, baixado de `geoftp.ibge.gov.br`. Os polígonos foram convertidos para GeoJSON em `data/biomes-ibge.geojson` e para SVG em `biome-geometry.js`, com uma cópia em JSON em `data/biomes-svg-paths.json`.
