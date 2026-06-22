const GAME_DATA = {
  traits: {
    agua_rasa: ["💧", "água rasa"],
    peixes: ["🐟", "peixes"],
    espaco_aberto: ["🌾", "espaço aberto"],
    area_aberta: ["🌾", "área aberta"],
    plantas_aquaticas: ["🌿", "plantas aquáticas"],
    arvores: ["🌳", "árvores"],
    frutos: ["🍌", "frutos"],
    insetos: ["🐛", "insetos"],
    abrigo: ["🏡", "abrigo"],
    muitos_abrigos: ["🏡", "muitos abrigos"],
    sol_forte: ["☀️", "sol forte"],
    muita_luz: ["☀️", "muito sol"],
    pouca_agua: ["🏜️", "pouca água"],
    guardar_agua: ["💦", "guardar água"],
    solo_seco: ["🪨", "solo seco"],
    plantas_resistentes: ["🌵", "plantas resistentes"],
    campo_aberto: ["🏞️", "campo aberto"],
    gramíneas: ["🌾", "gramíneas"],
    correr: ["👣", "correr"],
    andar_bastante: ["👣", "andar bastante"],
    arvores_tortas: ["🌳", "árvores tortas"],
    terra_vermelha: ["🧡", "terra vermelha"],
    rio_grande: ["🌊", "rio grande"],
    muita_agua: ["💧", "muita água"],
    muita_chuva: ["🌧️", "muita chuva"],
    floresta_alta: ["🌳", "floresta alta"],
    vento: ["🍃", "vento"],
  },

  species: {
    tuiuiu: {
      name: "Tuiuiú",
      image: "assets/especie-tuiuiu.png",
      needs: ["agua_rasa", "peixes", "espaco_aberto"],
      preferredHabitats: ["pantanal"],
      story:
        "O tuiuiú está procurando um lugar com água rasa, peixes e espaço para caminhar.",
      adaptation: {
        question: "O que ajuda o tuiuiú a andar na água rasa?",
        answer: "pernas compridas",
        options: ["pernas compridas", "espinhos", "mãos para galhos"],
        explanation: "As pernas compridas ajudam o tuiuiú a caminhar na água rasa.",
      },
    },
    mandacaru: {
      name: "Mandacaru",
      image: "assets/especie-mandacaru.png",
      needs: ["muita_luz", "pouca_agua", "guardar_agua"],
      preferredHabitats: ["caatinga"],
      story:
        "O mandacaru precisa de muito sol e sabe guardar água para viver em lugares secos.",
      adaptation: {
        question: "O que ajuda o mandacaru na seca?",
        answer: "caule que guarda água",
        options: ["caule que guarda água", "nadadeiras", "penas longas"],
        explanation: "Guardar água no caule ajuda o mandacaru em lugares secos.",
      },
    },
    mico: {
      name: "Mico-leão-dourado",
      image: "assets/especie-mico.png",
      needs: ["arvores", "frutos", "abrigo"],
      preferredHabitats: ["mata"],
      story:
        "O mico-leão-dourado procura árvores, frutos, insetos e lugares seguros para se abrigar.",
      adaptation: {
        question: "O que ajuda o mico a viver nas árvores?",
        answer: "mãos para segurar galhos",
        options: [
          "mãos para segurar galhos",
          "guardar água no caule",
          "andar na água rasa",
        ],
        explanation: "As mãos ajudam o mico a segurar nos galhos e se mover pela floresta.",
      },
    },
    loboGuara: {
      name: "Lobo-guará",
      image: "assets/especie-lobo-guara.png",
      needs: ["campo_aberto", "frutos", "andar_bastante"],
      preferredHabitats: ["cerrado"],
      story:
        "O lobo-guará quer um lugar aberto para andar bastante e procurar frutos entre arbustos.",
      adaptation: {
        question: "O que ajuda o lobo-guará a andar pelo Cerrado?",
        answer: "pernas longas",
        options: ["pernas longas", "nadadeiras", "espinhos"],
        explanation: "As pernas longas ajudam o lobo-guará a andar bastante pelo campo.",
      },
    },
    boto: {
      name: "Boto-cor-de-rosa",
      image: "assets/especie-boto.png",
      needs: ["rio_grande", "muita_agua", "peixes"],
      preferredHabitats: ["amazonia"],
      story:
        "O boto-cor-de-rosa precisa de um rio grande, muita água e peixes para nadar.",
      adaptation: {
        question: "O que ajuda o boto a nadar no rio?",
        answer: "nadadeiras",
        options: ["nadadeiras", "pernas longas", "caule que guarda água"],
        explanation: "As nadadeiras ajudam o boto a nadar no rio.",
      },
    },
    ema: {
      name: "Ema",
      image: "assets/especie-ema.png",
      needs: ["gramíneas", "campo_aberto", "correr"],
      preferredHabitats: ["pampa"],
      story:
        "A ema procura campos abertos, gramíneas e espaço para correr com suas pernas fortes.",
      adaptation: {
        question: "O que ajuda a ema a correr no campo aberto?",
        answer: "pernas fortes",
        options: ["pernas fortes", "mãos para segurar galhos", "nadadeiras"],
        explanation: "As pernas fortes ajudam a ema a correr no campo aberto.",
      },
    },
  },

  habitats: {
    pantanal: {
      name: "Pantanal alagado",
      image: "assets/bioma-pantanal.png",
      map: {
        label: "Pantanal",
        color: "#55b8d4",
        position: { left: "47%", top: "61%" },
        short: "Uma grande planície que enche de água e vira um berçário de vida.",
        story:
          "Quando as chuvas chegam, a água espalha devagar pelo Pantanal. Os peixes aparecem, as aves caminham na água rasa e muitos animais encontram comida. Na seca, a paisagem muda de novo, mas a vida já aprendeu a acompanhar esse ritmo.",
        facts: ["cheias e secas", "água rasa", "muitos peixes", "aves de pernas longas"],
      },
      traits: ["agua_rasa", "peixes", "area_aberta", "plantas_aquaticas"],
      aliases: ["espaco_aberto", "muita_agua"],
    },
    caatinga: {
      name: "Caatinga seca",
      image: "assets/bioma-caatinga.png",
      map: {
        label: "Caatinga",
        color: "#e59a48",
        position: { left: "69%", top: "44%" },
        short: "Um lugar quente e seco, cheio de plantas resistentes e surpresas na chuva.",
        story:
          "Na Caatinga, parece que tudo está dormindo quando a seca aperta. Mas muitas plantas guardam água, têm espinhos e esperam a chuva. Quando ela chega, folhas, flores e bichinhos aparecem depressa, como se o lugar acordasse.",
        facts: ["pouca água", "sol forte", "plantas resistentes", "flores depois da chuva"],
      },
      traits: ["sol_forte", "pouca_agua", "solo_seco", "plantas_resistentes"],
      aliases: ["muita_luz"],
    },
    mata: {
      name: "Mata Atlântica",
      image: "assets/bioma-mata-atlantica.png",
      map: {
        label: "Mata Atlântica",
        color: "#2e9f62",
        position: { left: "68%", top: "66%" },
        short: "Uma floresta úmida perto do litoral, com muitas árvores, frutos e abrigos.",
        story:
          "A Mata Atlântica é como uma casa de muitos andares. Lá em cima ficam copas, frutos e pássaros; no meio, galhos para pequenos animais; embaixo, folhas, insetos e raízes. Cada cantinho vira abrigo para alguém.",
        facts: ["floresta úmida", "muitas árvores", "frutos e insetos", "muitos abrigos"],
      },
      traits: ["arvores", "frutos", "insetos", "muitos_abrigos"],
      aliases: ["abrigo"],
    },
    cerrado: {
      name: "Cerrado",
      image: "assets/bioma-cerrado.png",
      map: {
        label: "Cerrado",
        color: "#d6a13c",
        position: { left: "56%", top: "50%" },
        short: "Campos, arbustos e árvores tortas sobre uma terra vermelha cheia de vida.",
        story:
          "No Cerrado, as árvores parecem pequenas e tortinhas, mas suas raízes vão fundo procurar água. Entre campos e arbustos, animais caminham bastante, procuram frutos e usam o espaço aberto para se mover.",
        facts: ["campo aberto", "árvores tortas", "terra vermelha", "raízes profundas"],
      },
      traits: ["campo_aberto", "arvores_tortas", "frutos", "terra_vermelha"],
      aliases: ["andar_bastante", "muita_luz"],
    },
    amazonia: {
      name: "Amazônia",
      image: "assets/bioma-amazonia.png",
      map: {
        label: "Amazônia",
        color: "#238b57",
        position: { left: "38%", top: "29%" },
        short: "Uma floresta imensa, úmida e cheia de rios grandes.",
        story:
          "Na Amazônia, a floresta conversa com a água. Chove bastante, os rios crescem, folhas caem, peixes se alimentam e muitos animais encontram caminhos entre árvores, igarapés e margens alagadas.",
        facts: ["muita chuva", "rios grandes", "floresta alta", "muita sombra"],
      },
      traits: ["muita_chuva", "rio_grande", "floresta_alta", "peixes"],
      aliases: ["muita_agua", "arvores"],
    },
    pampa: {
      name: "Pampa",
      image: "assets/bioma-pampa.png",
      map: {
        label: "Pampa",
        color: "#86b84c",
        position: { left: "57%", top: "83%" },
        short: "Campos abertos do sul, com gramíneas, vento e espaço para correr.",
        story:
          "No Pampa, o céu parece grande e o chão é coberto por muitos tipos de capim. O vento passa pelos campos, pequenos banhados guardam água e animais de pernas fortes conseguem correr por longas distâncias.",
        facts: ["gramíneas", "vento", "campo aberto", "banhados"],
      },
      traits: ["gramíneas", "vento", "campo_aberto", "correr"],
      aliases: ["espaco_aberto", "andar_bastante"],
    },
  },

  missions: [
    { species: "tuiuiu", habitats: ["pantanal", "amazonia", "caatinga"] },
    { species: "mandacaru", habitats: ["caatinga", "cerrado", "pantanal"] },
    { species: "mico", habitats: ["mata", "amazonia", "pampa"] },
    { species: "loboGuara", habitats: ["cerrado", "pampa", "mata"] },
    { species: "boto", habitats: ["amazonia", "pantanal", "caatinga"] },
    { species: "ema", habitats: ["pampa", "cerrado", "amazonia"] },
  ],
};
