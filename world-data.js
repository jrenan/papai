const WORLD_DATA = {
  countries: [
    {
      id: "brazil",
      name: "Brasil",
      flag: "🇧🇷",
      coords: { lat: -14.2, lon: -51.9 },
      region: "América do Sul",
      population: "cerca de 212 milhões",
      capital: "Brasília",
      exports: ["soja", "minério de ferro", "petróleo", "café", "carne bovina"],
      history:
        "O Brasil reúne povos indígenas, influências africanas e portuguesas. Foi colônia de Portugal, tornou-se independente em 1822 e hoje é uma grande democracia multicultural.",
      music:
        "Samba e choro: ritmos cheios de percussão, cordas e rodas de música.",
      color: "#20a464",
      landmarks: [
        {
          name: "Brasília - Praça dos Três Poderes",
          kind: "capital",
          lat: -15.7996,
          lon: -47.8645,
        },
        {
          name: "Rio de Janeiro - Cristo Redentor",
          kind: "ponto turístico",
          lat: -22.9519,
          lon: -43.2105,
        },
        {
          name: "Manaus - Teatro Amazonas",
          kind: "ponto turístico",
          lat: -3.1303,
          lon: -60.0233,
        },
      ],
    },
    {
      id: "japan",
      name: "Japão",
      flag: "🇯🇵",
      coords: { lat: 36.2, lon: 138.3 },
      region: "Ásia",
      population: "cerca de 124 milhões",
      capital: "Tóquio",
      exports: ["carros", "máquinas", "eletrônicos", "peças de precisão"],
      history:
        "O Japão tem uma história marcada por imperadores, samurais, cidades antigas e muita inovação. Depois da Segunda Guerra Mundial, tornou-se uma potência tecnológica e cultural.",
      music:
        "Taiko e shakuhachi: tambores fortes e flautas de bambu em melodias antigas.",
      color: "#f15b5b",
      landmarks: [
        {
          name: "Tóquio - Cruzamento de Shibuya",
          kind: "capital",
          lat: 35.6595,
          lon: 139.7005,
        },
        {
          name: "Quioto - Kiyomizu-dera",
          kind: "ponto turístico",
          lat: 34.9949,
          lon: 135.785,
        },
        {
          name: "Hiroshima - Memorial da Paz",
          kind: "ponto histórico",
          lat: 34.3955,
          lon: 132.4536,
        },
      ],
    },
    {
      id: "egypt",
      name: "Egito",
      flag: "🇪🇬",
      coords: { lat: 26.8, lon: 30.8 },
      region: "África",
      population: "cerca de 116 milhões",
      capital: "Cairo",
      exports: ["gás natural", "petróleo", "fertilizantes", "algodão", "cítricos"],
      history:
        "O Egito antigo construiu pirâmides, templos e uma escrita famosa chamada hieróglifos. O rio Nilo ajudou cidades a crescerem no deserto por milhares de anos.",
      music:
        "Música árabe egípcia: voz expressiva, oud, percussão e melodias ornamentadas.",
      color: "#d9a441",
      landmarks: [
        {
          name: "Cairo - Museu Egípcio",
          kind: "capital",
          lat: 30.0478,
          lon: 31.2336,
        },
        {
          name: "Guizé - Pirâmides",
          kind: "ponto turístico",
          lat: 29.9792,
          lon: 31.1342,
        },
        {
          name: "Luxor - Templo de Karnak",
          kind: "ponto histórico",
          lat: 25.7188,
          lon: 32.6573,
        },
      ],
    },
    {
      id: "kenya",
      name: "Quênia",
      flag: "🇰🇪",
      coords: { lat: 0.02, lon: 37.9 },
      region: "África",
      population: "cerca de 56 milhões",
      capital: "Nairóbi",
      exports: ["chá", "café", "flores", "legumes", "roupas"],
      history:
        "O Quênia fica perto do Vale do Rift, uma região importante para entender a história humana. O país conquistou sua independência em 1963 e reúne muitos povos e línguas.",
      music:
        "Benga e cantos tradicionais: guitarras vivas, ritmo dançante e coros.",
      color: "#28a889",
      landmarks: [
        {
          name: "Nairóbi - Museu Nacional",
          kind: "capital",
          lat: -1.2731,
          lon: 36.8147,
        },
        {
          name: "Nairóbi - Giraffe Centre",
          kind: "ponto turístico",
          lat: -1.3766,
          lon: 36.7423,
        },
        {
          name: "Mombaça - Forte Jesus",
          kind: "ponto histórico",
          lat: -4.0624,
          lon: 39.6796,
        },
      ],
    },
    {
      id: "france",
      name: "França",
      flag: "🇫🇷",
      coords: { lat: 46.2, lon: 2.2 },
      region: "Europa",
      population: "cerca de 68 milhões",
      capital: "Paris",
      exports: ["aviões", "remédios", "vinhos", "perfumes", "queijos"],
      history:
        "A França foi palco de castelos, artistas, cientistas e da Revolução Francesa. Suas ideias sobre direitos e cidadania influenciaram muitos lugares do mundo.",
      music:
        "Chanson francesa e acordeão: canções narrativas com clima de rua e café.",
      color: "#4976d1",
      landmarks: [
        {
          name: "Paris - Torre Eiffel",
          kind: "capital",
          lat: 48.8584,
          lon: 2.2945,
        },
        {
          name: "Paris - Museu do Louvre",
          kind: "ponto turístico",
          lat: 48.8606,
          lon: 2.3376,
        },
        {
          name: "Versalhes - Palácio",
          kind: "ponto histórico",
          lat: 48.8049,
          lon: 2.1204,
        },
      ],
    },
    {
      id: "australia",
      name: "Austrália",
      flag: "🇦🇺",
      coords: { lat: -25.3, lon: 133.8 },
      region: "Oceania",
      population: "cerca de 27 milhões",
      capital: "Camberra",
      exports: ["minério de ferro", "carvão", "gás natural", "trigo", "lã"],
      history:
        "A Austrália tem culturas aborígenes muito antigas, com histórias ligadas à terra e ao céu. Mais tarde recebeu colonos britânicos e se tornou um país diverso.",
      music:
        "Didgeridoo e canções aborígenes: sons graves, respiração contínua e histórias da paisagem.",
      color: "#f07c3e",
      landmarks: [
        {
          name: "Camberra - Parlamento",
          kind: "capital",
          lat: -35.3082,
          lon: 149.1245,
        },
        {
          name: "Sydney - Opera House",
          kind: "ponto turístico",
          lat: -33.8568,
          lon: 151.2153,
        },
        {
          name: "Uluru",
          kind: "ponto natural",
          lat: -25.3444,
          lon: 131.0369,
        },
      ],
    },
  ],
};
