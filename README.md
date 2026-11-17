# Trio do Saber - Jogos Infantis

Tela inicial de jogos infantis em HTML, CSS e JavaScript puro. O projeto reúne
**Guardiões dos Biomas**, **Viagem pelo Mundo**, **Dia e noite**, **Blocos de Somar**
e **Juntar e Somar**.

## DinoFala — aplicativo nativo para iOS

A implementação para iPhone e iPad foi movida para o projeto independente
[DinoFala](../DinoFala/README.md), em `/Users/jrenan/Documents/DinoFala`.
Abra `DinoFala.xcodeproj` nessa pasta. O app é dedicado ao Dino, com espelho
e exercícios do Fono do Leo em SwiftUI, ARKit e Vision como alternativa,
sem zoom de página por pinça. Os demais jogos continuam neste projeto web.
O reconhecimento facial precisa ser conferido em aparelho físico; exercícios
sem detector disponível continuam com confirmação do adulto.

O módulo web foi retirado do Trio do Saber. O endereço antigo
`fono-do-leo/` volta à tela inicial e desativa o cache offline do módulo.

## Como abrir

Com Node.js, Python 3.9+ e SQLite 3.35+ disponíveis, rode o site e a API da família:

```bash
npm start
```

Abra <http://localhost:8000/soma/> para entrar no **Jardim das somas**. Em
**Para os pais**, crie uma conta com e-mail e senha, cadastre um nome ou apelido e
escolha um bichinho. O seletor de perfil também aparece dentro de cada jogo. Em
**Para os pais**, o adulto pode ver as rodadas, os acertos sem ajuda ou erro e
as habilidades praticadas pela criança selecionada.

A trilha começa no **Juntar e Somar**, com totais até 5, até 10 e até 20.
Depois, o **Blocos de Somar** trabalha dezenas e unidades, somas até 50 sem
reagrupamento e trocas de dez unidades até 100. A recomendação usa as últimas
cinco rodadas por habilidade. Quatro acertos independentes em pelo menos três
contas diferentes sugerem avançar. O jogo intercala revisões, volta a combinações
que exigiram ajuda e permite escolher qualquer uma das paradas. A velocidade da
criança não altera o nível.

O progresso dos perfis fica em SQLite, por padrão em
`~/.local/share/trio-do-saber/family.sqlite3`. Use `FAMILY_DB` para definir outro
arquivo privado fora do projeto. A senha é protegida com scrypt e salt individual.
A sessão usa cookie HttpOnly com duração de 14 dias. Uma rodada concluída durante
uma falha de conexão fica na fila deste navegador, vinculada ao perfil que a
jogou, para sincronização. O visitante brinca sem cadastro e a trilha de visitante
dura apenas naquela aba.

## Publicação

O site público usa o GitHub Pages em `triodosaber.profjonas.com` e uma API própria
em `familia-trio.profjonas.com`. O frontend só usa esse segundo endereço quando
carregado no domínio público. A API aceita requisições autenticadas do navegador
apenas da origem HTTPS configurada em `FAMILY_ORIGIN`.

No Coolify, use o repositório com `Dockerfile.family`, porta interna 8000, domínio
`https://familia-trio.profjonas.com` e um **volume persistente nomeado** montado
em `/var/lib/trio`. O registro A desse subdomínio deve apontar para o proxy do
servidor. Preserve o cabeçalho Host e mantenha backups do banco. A imagem já
configura as duas origens e o caminho do SQLite. Seu healthcheck abre a API e
consulta a sessão de visitante.

Em uma instalação que serve os jogos e a API no mesmo host, defina
`FAMILY_ORIGIN` como a origem HTTPS desse site, omita `FAMILY_API_ORIGIN` ou
defina o mesmo valor, e encaminhe `/api/family/*` ao aplicativo WSGI
`scripts.family_server:create_app()`.

Em HTTPS a sessão recebe o atributo Secure. Se o proxy sobrescreve X-Real-IP
com o IP real de cada cliente, configure `FAMILY_TRUSTED_PROXY` com o IP exato
desse proxy para aplicar o limite de tentativas por endereço.

### Publicar os jogos no GitHub Pages

Depois de criar o repositório no GitHub:

```bash
git remote add origin https://github.com/SEU_USUARIO/papai.git
git branch -M main
git push -u origin main
```

No GitHub, abra **Settings > Pages** e escolha **Source: GitHub Actions**.
O workflow `.github/workflows/pages.yml` publica o site a cada push em `main`.

O modo VR depende do navegador e do óculos anunciarem suporte a `immersive-vr`.
Em navegadores sem esse suporte, o botão VR aparece desativado.

## Testes de regressão

Com Node.js instalado, prepare os navegadores uma vez:

```bash
npm ci
npx playwright install chromium webkit
```

Mantenha o servidor local acima rodando e execute em outro terminal:

```bash
npm test
```

O teste de família também pode ser executado com `npm run test:family`. Ele abre
seu próprio servidor local e usa um banco descartável.

Os testes verificam arquivos locais, as seis missões dos Biomas, a navegação
pelos países e os fluxos de soma, incluindo respostas erradas, novas contas,
teclado e confirmação de saída.
Para outro endereço, defina `BASE_URL`.
Para conferir apenas sintaxe e arquivos, use `npm run test:assets`.

## Narrações

Os quatro jogos compartilham MP3 da **Jessica**, gerados com **Eleven v4** em
português. O navegador carrega somente os trechos pedidos, sem acessar a API
ElevenLabs. Os dois jogos de soma mantêm os ajustes locais de velocidade e som.
Toque em **Ouvir** para repetir ou liberar a reprodução quando o navegador pedir.

O inventário completo, os comandos de geração e as verificações estão em
[`scripts/NARRATION.md`](scripts/NARRATION.md). Ao editar uma fala, atualize o
inventário e gere o áudio correspondente antes de publicar. A publicação exige
cobertura completa dos textos e hashes dos arquivos; não envia ferramentas,
credenciais ou áudios do DinoFala.

## O que está implementado

### Tela Inicial

- Tela inicial com a marca **Trio do Saber** e seletor de jogos.
- Estrutura pronta para adicionar novas aventuras sem refazer a navegação.
- Botões de retorno ao início em cada jogo.

### Dia e noite

- Experiência em `dia-e-noite/`, acessível pela tela inicial.
- Duas vistas conectam a Terra no espaço ao céu visto por uma criança na superfície.
- Arraste a Terra para girar; botões grandes permitem escolher dia, noite ou giro automático.
- O Sol permanece no mesmo lugar enquanto a Terra gira, mostrando por que um lugar recebe luz e depois fica no escuro.
- Amanhecer, entardecer, desafio de encontrar a luz e modo leve para aparelhos sem WebGL.
- Descoberta guiada com um adulto: brincar de girar, comparar corpo/Terra/lugar, prever, testar, explicar e investigar outro lugar. A exploração livre continua acessível. A sequência é informada por estudos científicos, detalhados em [`dia-e-noite/RESEARCH.md`](dia-e-noite/RESEARCH.md); testes técnicos não equivalem à validação de aprendizagem com crianças.
- Leo e Rafa aparecem como astronautas 3D, inspirados na arte do cabeçalho, com capacetes, mochilas e aceno suave. A flutuação tem pausa própria e respeita a preferência de movimento reduzido. Os modelos reutilizáveis ficam em `dia-e-noite/models/`; `scripts/render-astronauts.cjs` gera os JSON Three.js e os PNG do modo leve.
- Taubaté está marcada pelas coordenadas geográficas, tanto no globo 3D quanto no modo leve. O relógio de 24 horas acompanha a simulação; não representa a hora atual da cidade.
- Narração masculina preparada em `scripts/day-night-narration.py`, com 25 clipes em `dia-e-noite/narration-texts.json` e orientação por ícones. A geração dos MP3 ficou para depois, por decisão do usuário. Enquanto `audio/manifest.json` indicar `available: false`, os controles de voz ficam ocultos. Use `plan`, depois `discover` e `generate --voice-id ID --model-id eleven_v4` com uma voz masculina e saldo disponível. O pacote só é ativado após validar todos os arquivos.
- Verificação específica: `npm run test:day-night` com o servidor local ativo.

### Blocos de Somar

- Segunda parada do Jardim das somas, também acessível em `numberblocks-1-100/blocos-de-somar.html`.
- Jogo de adição com blocos coloridos e três níveis: até 20, até 50 e até 100.
- Interação de arrastar e soltar com peças e áreas de encaixe maiores para crianças.
- Layout adaptado a iPhone e iPad e orientação por voz em português.
- Imagens locais em `numberblocks-1-100/`, sem necessidade de instalação.
- Ao montar, os algarismos embaixo das casas D e U mostram o número que está
  se formando (2 | 3 = 23).
- Na etapa de juntar, depois de passar duas peças, o botão **Juntar o resto**
  leva as demais de uma vez.
- Na conta final, tocar na resposta também vale; arrastar continua funcionando.
- Uma mãozinha mostra o gesto esperado depois de 9 segundos parado ou ao tocar
  em **Ouvir**. Na conta final ela não entrega a resposta.
- Sair no meio de uma conta pede confirmação, e as estrelas ficam guardadas no
  perfil ativo. No modo visitante, o placar antigo continua disponível no aparelho.

### Juntar e Somar

- Primeira parada do Jardim das somas, também acessível em `numberblocks-somar/index.html`.
- Versão do jogo de somar com os personagens Numberblocks, pensada para crianças
  pequenas: níveis até 5, até 10, até 20 (com o Dez) e surpresa.
- Etapas: montar o primeiro amigo bloco por bloco, montar o segundo, arrastar um
  amigo até o outro para juntar, contar os blocos e escolher quantos são. Ao
  acertar, a figura ganha as cores, o rosto e o nome do personagem da soma.
- Os personagens são desenhados em HTML e CSS por `numberblocks-somar/numberblocks.js`
  e `numberblocks.css`, portados do convite do Rafa (`rafa-4-anos`). O mesmo
  modelo desenha o card na tela inicial.
- Usa a mesma voz (`numberblocks-1-100/game-voice.js`) e os mesmos ajustes de voz
  do Blocos de Somar.

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
- Exploração de 3 lugares por missão; ao investigar uma foto, o bioma pisca no mapa.
- Pistas escondidas que aparecem quando a criança investiga cada lugar.
- A escolha é feita arrastando o ser vivo até o bioma certo no mapa do Brasil.
  Perto da borda de biomas pequenos, como Pantanal e Pampa, o bioma mais próximo
  também vale. É possível tocar no ser vivo e depois no bioma. Pelo teclado,
  Enter pega o ser vivo e Enter num bioma o solta.
- Quem acerta fica no mapa, num alfinete com a foto, e o mapa final mostra todos
  em casa.
- Cálculo automático de compatibilidade usando características compartilhadas.
- Feedback por adequação: combina muito, combina um pouco e combina pouco.
- Pergunta de adaptação depois da melhor escolha.
- Botão de narração com arquivos MP3 da Jessica, gerados no Eleven v4.

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
    where: "no brejo",
    short: "Um lugar úmido com árvores, água e muitos sons.",
    story: "Depois da chuva, o brejo fica cheio de vida...",
    facts: ["muita água", "árvores", "insetos"],
  },
  traits: ["muita_agua", "arvores", "frutos"],
  aliases: ["abrigo"],
},
```

`map.where` é a frase usada no retorno ("no Pantanal", "na Caatinga"). Para uma
espécie com nome feminino, use `article: "a"` (como a ema).

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
