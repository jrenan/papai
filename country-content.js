const COUNTRY_CONTENT = {
  bra: {
    summary:
      "O Brasil é um país gigante da América do Sul. Tem floresta amazônica, cidades grandes, praias, cerrado, rios enormes e muitas pessoas vivendo de jeitos bem diferentes.",
    music: "Samba, choro, forró e bossa nova são músicas brasileiras; elas usam ritmo, dança, cordas, sopros e percussão para contar alegria, saudade e festa.",
    landmarks: [
      { name: "Brasília - Praça dos Três Poderes", lat: -15.7996, lon: -47.8645 },
      { name: "Rio de Janeiro - Cristo Redentor", lat: -22.9519, lon: -43.2105 },
      { name: "Manaus - Teatro Amazonas", lat: -3.1303, lon: -60.0233 },
    ],
  },
  rus: {
    summary:
      "A Rússia é o maior país do mundo. Ela atravessa muitos fusos horários, tem florestas muito frias, montanhas, cidades antigas, trens longos e lagos enormes.",
    music: "A música russa tem canções populares, coros fortes, balalaika, acordeão e melodias que podem soar alegres ou bem dramáticas.",
    landmarks: [
      { name: "Moscou - Praça Vermelha", lat: 55.7539, lon: 37.6208 },
      { name: "São Petersburgo - Museu Hermitage", lat: 59.9398, lon: 30.3146 },
      { name: "Lago Baikal", lat: 53.5587, lon: 108.165 },
    ],
  },
  jpn: {
    summary:
      "O Japão é formado por ilhas. Ele é lembrado por trens muito rápidos, tecnologia, desenhos animados, templos antigos e jardins bem cuidados.",
    music: "No Japão há tambores taiko, flautas de bambu e também músicas pop muito animadas.",
    landmarks: [
      { name: "Tóquio - Shibuya", lat: 35.6595, lon: 139.7005 },
      { name: "Quioto - Kiyomizu-dera", lat: 34.9949, lon: 135.785 },
      { name: "Hiroshima - Memorial da Paz", lat: 34.3955, lon: 132.4536 },
    ],
  },
  egy: {
    summary:
      "O Egito fica no nordeste da África, perto do rio Nilo. Tem deserto, cidades grandes, pirâmides, templos e histórias muito antigas com hieróglifos.",
    music: "A música egípcia usa voz, percussão, flautas e instrumentos de corda como o oud; há sons antigos, populares e modernos.",
    landmarks: [
      { name: "Cairo - Museu Egípcio", lat: 30.0478, lon: 31.2336 },
      { name: "Guizé - Pirâmides", lat: 29.9792, lon: 31.1342 },
      { name: "Luxor - Templo de Karnak", lat: 25.7188, lon: 32.6573 },
    ],
  },
  ken: {
    summary:
      "O Quênia tem savanas, montanhas e cidades movimentadas. Muitas famílias falam mais de uma língua e vivem perto de paisagens muito diferentes.",
    music: "No Quênia há músicas com coros, tambores, guitarras e ritmos para dançar.",
    landmarks: [
      { name: "Nairóbi - Museu Nacional", lat: -1.2731, lon: 36.8147 },
      { name: "Nairóbi - Giraffe Centre", lat: -1.3766, lon: 36.7423 },
      { name: "Mombaça - Forte Jesus", lat: -4.0624, lon: 39.6796 },
    ],
  },
  fra: {
    summary:
      "A França é lembrada por Paris, a Torre Eiffel, museus, castelos, pães, queijos e muitas obras de arte.",
    music: "A chanson francesa conta histórias cantadas, muitas vezes com acordeão e voz suave.",
    landmarks: [
      { name: "Paris - Torre Eiffel", lat: 48.8584, lon: 2.2945 },
      { name: "Paris - Museu do Louvre", lat: 48.8606, lon: 2.3376 },
      { name: "Versalhes - Palácio", lat: 48.8049, lon: 2.1204 },
    ],
  },
  aus: {
    summary:
      "A Austrália é uma ilha-continente cercada por oceanos. Ela tem desertos, praias, recifes, cidades grandes, animais famosos e culturas aborígenes muito antigas.",
    music: "O didgeridoo é um instrumento aborígene de som grave e comprido; também há músicas de muitas comunidades imigrantes e pop australiano.",
    landmarks: [
      { name: "Camberra - Parlamento", lat: -35.3082, lon: 149.1245 },
      { name: "Sydney - Opera House", lat: -33.8568, lon: 151.2153 },
      { name: "Uluru", lat: -25.3444, lon: 131.0369 },
    ],
  },
  usa: {
    summary:
      "Os Estados Unidos ficam na América do Norte. Têm cidades enormes, filmes, tecnologia, universidades, fazendas, desertos, montanhas e parques nacionais muito grandes.",
    music: "Jazz, blues, country, hip hop, gospel e rock são estilos importantes; muitos nasceram do encontro de povos indígenas, africanos, europeus e imigrantes.",
    landmarks: [
      { name: "Washington - Capitólio", lat: 38.8899, lon: -77.0091 },
      { name: "Nova York - Estátua da Liberdade", lat: 40.6892, lon: -74.0445 },
      { name: "Grand Canyon", lat: 36.1069, lon: -112.1129 },
    ],
  },
  can: {
    summary:
      "O Canadá é um país enorme e frio em muitas regiões. Tem florestas, lagos, neve, povos indígenas, cidades modernas e lugares onde se fala inglês e francês.",
    music: "No Canadá há tambores e cantos de povos indígenas, folk, música celta, pop e canções em inglês e francês.",
    landmarks: [
      { name: "Ottawa - Parlamento", lat: 45.4248, lon: -75.6992 },
      { name: "Toronto - CN Tower", lat: 43.6426, lon: -79.3871 },
      { name: "Niagara Falls", lat: 43.0962, lon: -79.0377 },
    ],
  },
  mex: {
    summary:
      "O México liga a América do Norte à América Central. Tem pirâmides antigas, desertos, florestas, comidas coloridas, praças, mercados e muitas histórias maias e astecas.",
    music: "Mariachi, son jarocho e ranchera são tradições mexicanas com violinos, trompetes, violões, harpas e vozes bem fortes.",
    landmarks: [
      { name: "Cidade do México - Zócalo", lat: 19.4326, lon: -99.1332 },
      { name: "Teotihuacan", lat: 19.6925, lon: -98.8438 },
      { name: "Chichén Itzá", lat: 20.6843, lon: -88.5678 },
    ],
  },
  arg: {
    summary:
      "A Argentina fica no sul da América do Sul. Tem pampas, montanhas dos Andes, geleiras, futebol, carne, vinho e uma capital cheia de teatros e cafés.",
    music: "O tango é uma música argentina e rioplatense marcada por dança, bandoneón e emoção; também há folclore com violão e bombo.",
    landmarks: [
      { name: "Buenos Aires - Obelisco", lat: -34.6037, lon: -58.3816 },
      { name: "Iguazú - Cataratas", lat: -25.6953, lon: -54.4367 },
      { name: "Perito Moreno", lat: -50.4967, lon: -73.1377 },
    ],
  },
  chl: {
    summary:
      "O Chile parece uma fita comprida na beira da América do Sul. Tem o deserto do Atacama no norte, os Andes ao lado, vinhas, cidades costeiras e gelo perto da Patagônia.",
    music: "A cueca é uma dança tradicional chilena com lenços, palmas, violão e jeito de brincadeira dançada.",
    landmarks: [
      { name: "Santiago - Plaza de Armas", lat: -33.4372, lon: -70.6506 },
      { name: "Valparaíso - Cerro Alegre", lat: -33.0393, lon: -71.628 },
      { name: "Deserto do Atacama", lat: -23.8634, lon: -69.1328 },
    ],
  },
  per: {
    summary:
      "O Peru fica na América do Sul. Tem montanhas dos Andes, floresta amazônica, lhamas, comidas famosas e cidades antigas de pedra como Machu Picchu.",
    music: "A música peruana usa quenas, charangos, tambores e danças dos Andes; alguns ritmos parecem caminhar pelas montanhas.",
    landmarks: [
      { name: "Lima - Plaza Mayor", lat: -12.0464, lon: -77.0306 },
      { name: "Machu Picchu", lat: -13.1631, lon: -72.545 },
      { name: "Cusco - Plaza de Armas", lat: -13.5167, lon: -71.9789 },
    ],
  },
  gbr: {
    summary:
      "O Reino Unido reúne países com castelos, universidades antigas, chuva famosa, reis e rainhas, música pop e ônibus vermelhos.",
    music: "Bandas de rock, corais e músicas tradicionais fazem parte da cultura do Reino Unido.",
    landmarks: [
      { name: "Londres - Big Ben", lat: 51.5007, lon: -0.1246 },
      { name: "Londres - Tower Bridge", lat: 51.5055, lon: -0.0754 },
      { name: "Edimburgo - Castelo", lat: 55.9486, lon: -3.1999 },
    ],
  },
  deu: {
    summary:
      "A Alemanha tem florestas, castelos, carros, trens, cidades antigas e muitos museus de ciência, arte e história.",
    music: "A Alemanha é conhecida por música clássica, corais e também música moderna.",
    landmarks: [
      { name: "Berlim - Portão de Brandemburgo", lat: 52.5163, lon: 13.3777 },
      { name: "Munique - Marienplatz", lat: 48.1374, lon: 11.5755 },
      { name: "Castelo de Neuschwanstein", lat: 47.5576, lon: 10.7498 },
    ],
  },
  ita: {
    summary:
      "A Itália parece uma bota no mapa. Ela é lembrada por massas, pizzas, ruínas antigas, praças, igrejas e muitas obras de arte.",
    music: "A ópera italiana usa vozes grandes para contar histórias cantadas.",
    landmarks: [
      { name: "Roma - Coliseu", lat: 41.8902, lon: 12.4922 },
      { name: "Veneza - Praça São Marcos", lat: 45.4342, lon: 12.3388 },
      { name: "Pisa - Torre Inclinada", lat: 43.723, lon: 10.3966 },
    ],
  },
  esp: {
    summary:
      "A Espanha tem praias, montanhas, cidades antigas, futebol, praças animadas e festas com música e dança.",
    music: "O flamenco usa palmas, violão, canto e dança forte.",
    landmarks: [
      { name: "Madri - Plaza Mayor", lat: 40.4154, lon: -3.7074 },
      { name: "Barcelona - Sagrada Família", lat: 41.4036, lon: 2.1744 },
      { name: "Granada - Alhambra", lat: 37.1761, lon: -3.5881 },
    ],
  },
  prt: {
    summary:
      "Portugal fica perto do oceano Atlântico. Tem azulejos, castelos, praias, bacalhau, fado e cidades com ruas de pedra.",
    music: "O fado é uma música portuguesa cantada com emoção e guitarra portuguesa.",
    landmarks: [
      { name: "Lisboa - Torre de Belém", lat: 38.6916, lon: -9.216 },
      { name: "Lisboa - Praça do Comércio", lat: 38.7077, lon: -9.1365 },
      { name: "Porto - Ponte Dom Luís I", lat: 41.1405, lon: -8.6096 },
    ],
  },
  chn: {
    summary:
      "A China é muito grande e muito populosa. Tem desertos, montanhas, rios, cidades enormes, invenções antigas e algumas das maiores fábricas e produções do mundo.",
    music: "A música chinesa pode usar guqin, erhu, pipa, tambores e flautas; muitos sons parecem desenhar paisagens, histórias e movimentos.",
    landmarks: [
      { name: "Pequim - Cidade Proibida", lat: 39.9163, lon: 116.3972 },
      { name: "Grande Muralha - Mutianyu", lat: 40.4319, lon: 116.5704 },
      { name: "Xangai - Bund", lat: 31.2402, lon: 121.4903 },
    ],
  },
  ind: {
    summary:
      "A Índia é um país muito populoso do sul da Ásia. Tem muitas línguas, comidas, religiões, festas coloridas, rios importantes, filmes e cidades muito movimentadas.",
    music: "A música indiana pode usar tabla, sitar, canto e ragas; os ritmos parecem conversar com a melodia.",
    landmarks: [
      { name: "Nova Délhi - India Gate", lat: 28.6129, lon: 77.2295 },
      { name: "Agra - Taj Mahal", lat: 27.1751, lon: 78.0421 },
      { name: "Jaipur - Hawa Mahal", lat: 26.9239, lon: 75.8267 },
    ],
  },
  zaf: {
    summary:
      "A África do Sul fica na ponta sul da África. Tem praias, montanhas, savanas, grandes cidades, muitos idiomas e culturas vivendo juntas.",
    music: "A música sul-africana tem coros fortes, percussão, danças, jazz, gospel e estilos populares como mbaqanga e kwaito.",
    landmarks: [
      { name: "Cidade do Cabo - Table Mountain", lat: -33.9628, lon: 18.4098 },
      { name: "Pretória - Union Buildings", lat: -25.7401, lon: 28.2119 },
      { name: "Joanesburgo - Constitution Hill", lat: -26.1886, lon: 28.0423 },
    ],
  },
  mar: {
    summary:
      "O Marrocos tem desertos, montanhas, mercados coloridos e cidades antigas com ruas estreitas.",
    music: "A música marroquina mistura tambores, cordas, canto e palmas.",
    landmarks: [
      { name: "Rabat - Torre Hassan", lat: 34.024, lon: -6.8224 },
      { name: "Marrakesh - Jemaa el-Fnaa", lat: 31.6258, lon: -7.9891 },
      { name: "Casablanca - Mesquita Hassan II", lat: 33.6085, lon: -7.6326 },
    ],
  },
  ner: {
    summary:
      "O Níger fica no Sahel, perto do deserto do Saara. Tem cidades, rios, caravanas, povos nômades, mercados e muitas histórias contadas em família.",
    music: "No Níger há músicas haúsa, zarma-songhai, tuaregues e fulas, com tambores, cordas, palmas, canto e guitarras do deserto.",
    landmarks: [
      { name: "Niamey - Museu Nacional Boubou Hama", lat: 13.5166, lon: 2.1157 },
      { name: "Niamey - Grande Mesquita", lat: 13.5253, lon: 2.1157 },
      { name: "Agadez - Grande Mesquita", lat: 16.9742, lon: 7.9865 },
    ],
  },
  tur: {
    summary:
      "A Turquia fica entre a Europa e a Ásia. Tem mercados cheios de cores, mesquitas, ruínas de povos antigos, comidas famosas e a Capadócia, onde balões sobem no céu.",
    music: "A música turca usa saz, darbuka, ney, canto e ritmos de dança que aparecem em festas, histórias e cerimônias.",
    landmarks: [
      { name: "Ancara - Anıtkabir", lat: 39.9251, lon: 32.8369 },
      { name: "Istambul - Santa Sofia", lat: 41.0086, lon: 28.9802 },
      { name: "Capadócia - Göreme", lat: 38.6431, lon: 34.8289 },
    ],
  },
  kor: {
    summary:
      "A Coreia do Sul tem montanhas, cidades tecnológicas, palácios antigos e muita cultura pop.",
    music: "Na Coreia do Sul há música tradicional com tambores e também K-pop.",
    landmarks: [
      { name: "Seul - Gyeongbokgung", lat: 37.5796, lon: 126.977 },
      { name: "Seul - N Seoul Tower", lat: 37.5512, lon: 126.9882 },
      { name: "Busan - Haeundae", lat: 35.1587, lon: 129.1604 },
    ],
  },
  idn: {
    summary:
      "A Indonésia é feita de milhares de ilhas. Tem vulcões, florestas, praias, arrozais, cidades grandes e muitas culturas diferentes vivendo perto do mar.",
    music: "O gamelão usa gongos, metalofones e tambores com sons brilhantes, muito comuns em Java e Bali.",
    landmarks: [
      { name: "Jacarta - Monas", lat: -6.1754, lon: 106.8272 },
      { name: "Borobudur", lat: -7.6079, lon: 110.2038 },
      { name: "Bali - Ubud", lat: -8.5069, lon: 115.2625 },
    ],
  },
  afg: {
    summary:
      "O Afeganistão tem montanhas muito altas, vales secos e cidades antigas por onde já passaram caravanas, estudiosos e comerciantes entre a Ásia Central e o sul da Ásia.",
    music: "A música afegã usa rubab, tabla, harmônio e cantos que contam histórias de família, viagem e saudade.",
    landmarks: [
      { name: "Cabul - Jardins de Babur", lat: 34.5033, lon: 69.1581 },
      { name: "Bamiyan - Vale dos Budas", lat: 34.832, lon: 67.826 },
      { name: "Herat - Cidadela", lat: 34.3482, lon: 62.1997 },
    ],
  },
  ala: {
    summary:
      "A Alândia é um grupo de ilhas no mar Báltico. Tem barcos, faróis, vento frio e vilas tranquilas perto da água.",
    music: "Nas ilhas da Alândia há músicas nórdicas com acordeão, violino e canções de festa.",
    landmarks: [
      { name: "Mariehamn - Museu Marítimo", lat: 60.0973, lon: 19.9279 },
      { name: "Castelo de Kastelholm", lat: 60.2308, lon: 20.0836 },
      { name: "Farol de Märket", lat: 60.3008, lon: 19.1328 },
    ],
  },
  alb: {
    summary:
      "A Albânia tem praias azuis, montanhas, castelos e cidades antigas com ruas de pedra.",
    music: "A música albanesa tem cantos fortes, danças em roda e sons de clarinete e tambor.",
    landmarks: [
      { name: "Tirana - Praça Skanderbeg", lat: 41.3275, lon: 19.8187 },
      { name: "Berat - Castelo", lat: 40.7086, lon: 19.9457 },
      { name: "Butrinto", lat: 39.7459, lon: 20.0208 },
    ],
  },
  and: {
    summary:
      "Andorra é um país pequeno nas montanhas dos Pireneus. No inverno, muita gente vai para lá ver neve.",
    music: "Em Andorra aparecem músicas de montanha, danças tradicionais e sons de festa popular.",
    landmarks: [
      { name: "Andorra-a-Velha - Casa de la Vall", lat: 42.5064, lon: 1.5218 },
      { name: "Santuário de Meritxell", lat: 42.5547, lon: 1.5904 },
      { name: "Vallnord - Pal Arinsal", lat: 42.5724, lon: 1.4891 },
    ],
  },
  ago: {
    summary:
      "Angola fica na costa oeste da África. Tem praias, rios, savanas, petróleo, diamantes e uma capital perto do oceano onde muitas pessoas falam português.",
    music: "Semba, kizomba e kuduro são ritmos de Angola com dança, batidas animadas e histórias de cidade e de família.",
    landmarks: [
      { name: "Luanda - Fortaleza de São Miguel", lat: -8.8136, lon: 13.2302 },
      { name: "Miradouro da Lua", lat: -9.4086, lon: 13.1421 },
      { name: "Quedas de Kalandula", lat: -9.0744, lon: 16.0019 },
    ],
  },
  aia: {
    summary:
      "Anguilla é uma ilha caribenha com praias claras, mar azul e barcos pequenos perto da areia.",
    music: "Em Anguilla há calipso, reggae e músicas de ilha com tambores e guitarras.",
    landmarks: [
      { name: "The Valley - centro da ilha", lat: 18.2208, lon: -63.0517 },
      { name: "Shoal Bay", lat: 18.2542, lon: -63.0368 },
      { name: "Sandy Ground", lat: 18.2014, lon: -63.0894 },
    ],
  },
  ata: {
    summary:
      "A Antártida é muito fria e coberta de gelo. Quase não há cidades: cientistas visitam para estudar o planeta.",
    music: "Na Antártida não existe música tradicional de moradores, mas dá para imaginar o som do vento e do gelo.",
    landmarks: [
      { name: "Polo Sul", lat: -90, lon: 0 },
      { name: "Estação McMurdo", lat: -77.8419, lon: 166.6863 },
      { name: "Península Antártica", lat: -64.5, lon: -63.0 },
    ],
  },
  atg: {
    summary:
      "Antígua e Barbuda são ilhas do Caribe com praias, recifes e muitos barcos coloridos.",
    music: "Calipso, soca e steelpan aparecem em festas e desfiles das ilhas.",
    landmarks: [
      { name: "Saint John's - porto", lat: 17.1274, lon: -61.8468 },
      { name: "Nelson's Dockyard", lat: 17.0085, lon: -61.7653 },
      { name: "Shirley Heights", lat: 17.0027, lon: -61.7606 },
    ],
  },
  sau: {
    summary:
      "A Arábia Saudita fica na Península Arábica. Tem desertos imensos, cidades grandes, oásis, petróleo e lugares muito importantes para muitos muçulmanos.",
    music: "A música saudita usa canto, palmas, tambores e danças em grupo, como a ardah, feita em celebrações.",
    landmarks: [
      { name: "Riad - Kingdom Centre", lat: 24.7113, lon: 46.6744 },
      { name: "Diriyah - At-Turaif", lat: 24.734, lon: 46.5753 },
      { name: "AlUla - Hegra", lat: 26.7989, lon: 37.9556 },
    ],
  },
  dza: {
    summary:
      "A Argélia é o maior país da África. Tem uma parte enorme do deserto do Saara, cidades perto do mar Mediterrâneo e montanhas ao norte.",
    music: "Na Argélia há raï, música chaabi e bedoui, com canto, tambores, cordas e ritmos do norte da África.",
    landmarks: [
      { name: "Argel - Casbá", lat: 36.7847, lon: 3.0606 },
      { name: "Timgad", lat: 35.4846, lon: 6.4686 },
      { name: "Ghardaïa - Vale do M'zab", lat: 32.489, lon: 3.6738 },
    ],
  },
  arm: {
    summary:
      "A Armênia tem montanhas, mosteiros antigos e histórias guardadas em pedras, músicas e igrejas.",
    music: "O duduk é um instrumento armênio de som doce e melancólico.",
    landmarks: [
      { name: "Erevan - Praça da República", lat: 40.1772, lon: 44.5126 },
      { name: "Mosteiro de Geghard", lat: 40.1404, lon: 44.8185 },
      { name: "Templo de Garni", lat: 40.1124, lon: 44.7301 },
    ],
  },
  abw: {
    summary:
      "Aruba é uma ilha do Caribe com praias, cactus, vento e água clara para nadar.",
    music: "Em Aruba há tumba, calipso, salsa e músicas animadas de carnaval.",
    landmarks: [
      { name: "Oranjestad - centro histórico", lat: 12.519, lon: -70.037 },
      { name: "Farol California", lat: 12.613, lon: -70.0515 },
      { name: "Eagle Beach", lat: 12.5486, lon: -70.0572 },
    ],
  },
  aut: {
    summary:
      "A Áustria tem montanhas nevadas, lagos, palácios e cidades famosas por música clássica.",
    music: "A valsa e a música clássica são muito lembradas na Áustria.",
    landmarks: [
      { name: "Viena - Palácio Schönbrunn", lat: 48.1845, lon: 16.3122 },
      { name: "Viena - Catedral de Santo Estêvão", lat: 48.2085, lon: 16.3731 },
      { name: "Salzburgo - Fortaleza Hohensalzburg", lat: 47.795, lon: 13.0477 },
    ],
  },
  aze: {
    summary:
      "O Azerbaijão fica perto do mar Cáspio. Tem montanhas, cidades antigas e torres modernas em Baku.",
    music: "O mugham é uma música tradicional do Azerbaijão com canto e instrumentos de corda.",
    landmarks: [
      { name: "Baku - Cidade Antiga", lat: 40.3667, lon: 49.8333 },
      { name: "Baku - Torres Flame", lat: 40.3599, lon: 49.8277 },
      { name: "Gobustão - paisagem de rochas", lat: 40.1049, lon: 49.4158 },
    ],
  },
  bhs: {
    summary:
      "As Bahamas são ilhas com praias claras, mar azul, recifes e barcos que passam entre muitas ilhas.",
    music: "Junkanoo é uma festa musical das Bahamas com tambores, sinos e fantasias coloridas.",
    landmarks: [
      { name: "Nassau - Parliament Square", lat: 25.0781, lon: -77.3383 },
      { name: "Nassau - Queen's Staircase", lat: 25.0731, lon: -77.3385 },
      { name: "Paradise Island - Atlantis", lat: 25.0843, lon: -77.3216 },
    ],
  },
  bhr: {
    summary:
      "O Bahrein é um país de ilhas no Golfo Pérsico. Tem barcos, pérolas, mercados e prédios modernos.",
    music: "O fidjeri é uma música ligada aos antigos mergulhadores de pérolas.",
    landmarks: [
      { name: "Manama - Bab Al Bahrain", lat: 26.2343, lon: 50.5751 },
      { name: "Forte do Bahrein", lat: 26.2331, lon: 50.5208 },
      { name: "Árvore da Vida", lat: 25.994, lon: 50.5831 },
    ],
  },
  bgd: {
    summary:
      "Bangladesh tem muitos rios, barcos, plantações de arroz e cidades cheias de movimento.",
    music: "A música bengali tem canções poéticas, tambores e instrumentos de corda.",
    landmarks: [
      { name: "Daca - Parlamento Nacional", lat: 23.7625, lon: 90.3786 },
      { name: "Daca - Ahsan Manzil", lat: 23.7086, lon: 90.406 },
      { name: "Sundarbans", lat: 21.9497, lon: 89.1833 },
    ],
  },
  brb: {
    summary:
      "Barbados é uma ilha do Caribe com praias, cavernas, plantações antigas e festas com música.",
    music: "Calipso, soca e tuk band aparecem em festas de Barbados.",
    landmarks: [
      { name: "Bridgetown - centro histórico", lat: 13.0969, lon: -59.6145 },
      { name: "Harrison's Cave", lat: 13.1846, lon: -59.5888 },
      { name: "Bathsheba Beach", lat: 13.2114, lon: -59.5251 },
    ],
  },
  bel: {
    summary:
      "A Bélgica tem praças antigas, castelos, canais, quadrinhos famosos e cidades onde se fala mais de uma língua.",
    music: "Na Bélgica há música clássica, bandas, jazz e canções em francês, neerlandês e alemão.",
    landmarks: [
      { name: "Bruxelas - Grand Place", lat: 50.8467, lon: 4.3525 },
      { name: "Bruxelas - Atomium", lat: 50.8949, lon: 4.3415 },
      { name: "Bruges - Markt", lat: 51.2089, lon: 3.2242 },
    ],
  },
  blz: {
    summary:
      "Belize tem mar azul, recifes, florestas e ruínas maias escondidas entre árvores.",
    music: "Em Belize há punta, reggae e músicas garífunas com tambores.",
    landmarks: [
      { name: "Belmopan - centro cívico", lat: 17.251, lon: -88.759 },
      { name: "Great Blue Hole", lat: 17.3158, lon: -87.5345 },
      { name: "Xunantunich", lat: 17.0893, lon: -89.1425 },
    ],
  },
  ben: {
    summary:
      "Benin fica na África Ocidental. Tem mercados, lagos, palácios antigos e histórias de muitos povos.",
    music: "A música do Benin tem tambores, vozes em coro e ritmos para dançar.",
    landmarks: [
      { name: "Porto-Novo - Grande Mesquita", lat: 6.4969, lon: 2.6289 },
      { name: "Cotonou - mercado Dantokpa", lat: 6.3717, lon: 2.4286 },
      { name: "Abomey - Palácios Reais", lat: 7.1853, lon: 1.9912 },
    ],
  },
  bmu: {
    summary:
      "Bermudas são ilhas no oceano Atlântico, com casas coloridas, praias rosadas e muitos barcos.",
    music: "Nas Bermudas há gombey, com tambores, dança e roupas coloridas.",
    landmarks: [
      { name: "Hamilton - Front Street", lat: 32.2948, lon: -64.782 },
      { name: "Horseshoe Bay", lat: 32.2496, lon: -64.8207 },
      { name: "St. George's", lat: 32.3818, lon: -64.677 },
    ],
  },
  blr: {
    summary:
      "A Bielorrússia tem florestas, lagos, castelos e cidades com praças largas.",
    music: "A música bielorrussa tem cantos populares, acordeão e danças de roda.",
    landmarks: [
      { name: "Minsk - Praça da Independência", lat: 53.8961, lon: 27.5486 },
      { name: "Castelo de Mir", lat: 53.4513, lon: 26.4726 },
      { name: "Castelo de Nesvizh", lat: 53.2226, lon: 26.6917 },
    ],
  },
  bol: {
    summary:
      "A Bolívia fica no coração da América do Sul. Tem montanhas altas, lagos, florestas, cidades andinas e salares que parecem um chão branco gigante.",
    music: "A música boliviana usa flautas andinas, charango, tambores e danças como morenada, caporales e tinku.",
    landmarks: [
      { name: "Sucre - Plaza 25 de Mayo", lat: -19.0477, lon: -65.2591 },
      { name: "La Paz - teleférico", lat: -16.4897, lon: -68.1193 },
      { name: "Salar de Uyuni", lat: -20.1338, lon: -67.4891 },
    ],
  },
  bih: {
    summary:
      "A Bósnia e Herzegovina tem montanhas, rios claros, pontes antigas e cidades com muitas histórias.",
    music: "A sevdalinka é uma canção tradicional da Bósnia, cantada com muita emoção.",
    landmarks: [
      { name: "Sarajevo - Baščaršija", lat: 43.8596, lon: 18.4318 },
      { name: "Mostar - Stari Most", lat: 43.3373, lon: 17.815 },
      { name: "Jajce - cachoeira", lat: 44.342, lon: 17.2706 },
    ],
  },
  bwa: {
    summary:
      "Botswana tem savanas, desertos e o delta do Okavango, onde a água cria caminhos para muitos animais.",
    music: "Em Botswana há cantos, palmas, tambores e danças tradicionais.",
    landmarks: [
      { name: "Gaborone - Three Dikgosi Monument", lat: -24.6475, lon: 25.9099 },
      { name: "Delta do Okavango", lat: -19.3, lon: 22.9 },
      { name: "Parque Chobe", lat: -18.75, lon: 24.6667 },
    ],
  },
  brn: {
    summary:
      "Brunei fica na ilha de Bornéu. Tem floresta tropical, rios e mesquitas douradas.",
    music: "A música de Brunei tem gongos, tambores e canções de celebração.",
    landmarks: [
      { name: "Bandar Seri Begawan - Mesquita Omar Ali Saifuddien", lat: 4.8903, lon: 114.9398 },
      { name: "Kampong Ayer", lat: 4.8833, lon: 114.9333 },
      { name: "Parque Ulu Temburong", lat: 4.4786, lon: 115.2078 },
    ],
  },
  bgr: {
    summary:
      "A Bulgária tem montanhas, mosteiros, rosas famosas e cidades antigas perto do mar Negro.",
    music: "A música búlgara tem coros fortes, gaitas de fole e ritmos diferentes.",
    landmarks: [
      { name: "Sófia - Catedral Alexander Nevsky", lat: 42.6958, lon: 23.3329 },
      { name: "Mosteiro de Rila", lat: 42.1335, lon: 23.3402 },
      { name: "Plovdiv - teatro romano", lat: 42.1469, lon: 24.751 },
    ],
  },
  bfa: {
    summary:
      "Burkina Faso fica na África Ocidental. Tem savanas, mercados e muitas tradições de máscaras e dança.",
    music: "A música de Burkina Faso usa balafon, tambores e coros animados.",
    landmarks: [
      { name: "Ouagadougou - Place des Cinéastes", lat: 12.3714, lon: -1.5197 },
      { name: "Ruínas de Loropéni", lat: 10.2503, lon: -3.5833 },
      { name: "Banfora - Cascades de Karfiguéla", lat: 10.6333, lon: -4.75 },
    ],
  },
  bdi: {
    summary:
      "Burundi tem colinas verdes, lagos e comunidades que usam tambores em festas importantes.",
    music: "Os tambores reais do Burundi são fortes, rápidos e tocados em grupo.",
    landmarks: [
      { name: "Gitega - Museu Nacional", lat: -3.4264, lon: 29.9306 },
      { name: "Bujumbura - Lago Tanganyika", lat: -3.3822, lon: 29.3644 },
      { name: "Gishora - Santuário dos Tambores", lat: -3.4097, lon: 29.9489 },
    ],
  },
  btn: {
    summary:
      "O Butão fica nos Himalaias. Tem montanhas altas, mosteiros coloridos e muitas bandeirinhas de oração.",
    music: "A música butanesa usa cantos, tambores e danças com roupas tradicionais.",
    landmarks: [
      { name: "Thimphu - Tashichho Dzong", lat: 27.4896, lon: 89.6356 },
      { name: "Paro - Ninho do Tigre", lat: 27.4918, lon: 89.3639 },
      { name: "Punakha Dzong", lat: 27.5921, lon: 89.8774 },
    ],
  },
  cpv: {
    summary:
      "Cabo Verde é feito de ilhas no oceano Atlântico. Tem praias, montanhas vulcânicas e muitas músicas.",
    music: "Morna e funaná são músicas de Cabo Verde com voz, dança e instrumentos de corda.",
    landmarks: [
      { name: "Praia - Plateau", lat: 14.9177, lon: -23.5092 },
      { name: "Cidade Velha", lat: 14.9153, lon: -23.6053 },
      { name: "Ilha do Fogo - Pico do Fogo", lat: 14.95, lon: -24.35 },
    ],
  },
  cmr: {
    summary:
      "Camarões tem praias, florestas, montanhas e savanas. Por isso às vezes é chamado de África em miniatura.",
    music: "Makossa e bikutsi são ritmos camaroneses com guitarra, percussão e dança.",
    landmarks: [
      { name: "Yaoundé - Monumento da Reunificação", lat: 3.848, lon: 11.5021 },
      { name: "Douala - La Nouvelle Liberté", lat: 4.0615, lon: 9.746 },
      { name: "Monte Camarões", lat: 4.217, lon: 9.172 },
    ],
  },
  khm: {
    summary:
      "O Camboja tem templos muito antigos, arrozais, rios e histórias do antigo império Khmer.",
    music: "A música cambojana usa xilofones, gongos, flautas e danças delicadas.",
    landmarks: [
      { name: "Phnom Penh - Palácio Real", lat: 11.563, lon: 104.931 },
      { name: "Angkor Wat", lat: 13.4125, lon: 103.867 },
      { name: "Siem Reap - centro", lat: 13.3671, lon: 103.8448 },
    ],
  },
  qat: {
    summary:
      "O Catar fica numa península pequena e quente. Tem deserto, mar, arranha-céus e museus modernos.",
    music: "A música do Catar usa tambores, palmas e canções ligadas ao mar e aos barcos.",
    landmarks: [
      { name: "Doha - Corniche", lat: 25.2948, lon: 51.531 },
      { name: "Doha - Museu de Arte Islâmica", lat: 25.2955, lon: 51.5392 },
      { name: "Souq Waqif", lat: 25.2867, lon: 51.5333 },
    ],
  },
  kaz: {
    summary:
      "O Cazaquistão fica no centro da Ásia. Tem estepes enormes, montanhas, cavalos, cidades modernas e tanto espaço aberto que o céu parece gigante.",
    music: "O dombra é um instrumento de duas cordas muito importante; ele acompanha histórias cantadas, danças e melodias das estepes.",
    landmarks: [
      { name: "Astana - Bayterek", lat: 51.1282, lon: 71.4304 },
      { name: "Almaty - Kok Tobe", lat: 43.2333, lon: 76.9769 },
      { name: "Charyn Canyon", lat: 43.3508, lon: 79.0803 },
    ],
  },
  cod: {
    summary:
      "A República Democrática do Congo fica no coração da África. Tem floresta tropical, o rio Congo, muitos minerais e cidades cheias de música e movimento.",
    music: "A rumba congolesa e o soukous usam guitarras dançantes, vozes em grupo e ritmos que fazem muita gente querer mexer os pés.",
    landmarks: [
      { name: "Kinshasa - Boulevard du 30 Juin", lat: -4.3195, lon: 15.3124 },
      { name: "Parque Nacional de Virunga", lat: -0.9167, lon: 29.1667 },
      { name: "Lola ya Bonobo", lat: -4.4939, lon: 15.2663 },
    ],
  },
  sdn: {
    summary:
      "O Sudão fica no nordeste da África. O rio Nilo passa por lá, há desertos, cidades antigas, pirâmides de Meroe e povos com muitas línguas e costumes.",
    music: "A música sudanesa mistura canto, tambores, palmas, oud e ritmos do vale do Nilo e de várias comunidades do país.",
    landmarks: [
      { name: "Cartum - encontro dos Nilos", lat: 15.6475, lon: 32.5072 },
      { name: "Pirâmides de Meroe", lat: 16.935, lon: 33.7489 },
      { name: "Museu Nacional do Sudão", lat: 15.6067, lon: 32.5097 },
    ],
  },
  tcd: {
    summary:
      "O Chade fica no centro-norte da África. Tem deserto, savanas, rochas enormes no Ennedi e o lago Chade, importante para pessoas e animais.",
    music: "A música chadiana usa tambores, flautas, cordas e cantos de diferentes povos, com ritmos do Sahel e da bacia do lago Chade.",
    landmarks: [
      { name: "N'Djamena - Grande Mesquita", lat: 12.1131, lon: 15.0491 },
      { name: "Lago Chade", lat: 13.0, lon: 14.0 },
      { name: "Ennedi - formações rochosas", lat: 17.0417, lon: 21.8628 },
    ],
  },
  lby: {
    summary:
      "A Líbia fica no norte da África. Tem muito deserto do Saara, cidades perto do mar Mediterrâneo, oásis e ruínas antigas de romanos e gregos.",
    music: "A música líbia mistura canto árabe, palmas, tambores, poesia e sons do deserto e das cidades costeiras.",
    landmarks: [
      { name: "Trípoli - Arco de Marco Aurélio", lat: 32.8972, lon: 13.1809 },
      { name: "Leptis Magna", lat: 32.6386, lon: 14.2919 },
      { name: "Ghadames - cidade antiga", lat: 30.1337, lon: 9.5007 },
    ],
  },
  irn: {
    summary:
      "O Irã fica no oeste da Ásia. Tem desertos, montanhas, jardins, bazares, cidades antigas e poesias muito importantes para muitas famílias.",
    music: "A música persa usa instrumentos como tar, setar, santur, ney e tombak; muitas melodias parecem conversa entre poesia e som.",
    landmarks: [
      { name: "Teerã - Torre Azadi", lat: 35.6997, lon: 51.3378 },
      { name: "Isfahan - Praça Naqsh-e Jahan", lat: 32.6573, lon: 51.6776 },
      { name: "Persépolis", lat: 29.9355, lon: 52.8916 },
    ],
  },
  mng: {
    summary:
      "A Mongólia fica entre a Rússia e a China. Tem estepes enormes, cavalos, famílias nômades, tendas chamadas gers e o deserto de Gobi.",
    music: "A música mongol é lembrada pelo morin khuur, um instrumento de cordas, e pelo canto de garganta, que parece fazer mais de um som ao mesmo tempo.",
    landmarks: [
      { name: "Ulaanbaatar - Praça Sükhbaatar", lat: 47.9185, lon: 106.9176 },
      { name: "Mosteiro Gandantegchinlen", lat: 47.9231, lon: 106.8947 },
      { name: "Deserto de Gobi - Khongoryn Els", lat: 43.8041, lon: 102.1746 },
    ],
  },
  mli: {
    summary:
      "O Mali fica no oeste da África. Tem deserto, o rio Níger, cidades antigas de comércio e histórias de grandes impérios africanos.",
    music: "A música do Mali usa kora, ngoni, balafon, tambores e vozes que contam histórias de famílias, viajantes e griôs.",
    landmarks: [
      { name: "Bamako - Museu Nacional", lat: 12.6492, lon: -8.0006 },
      { name: "Djenne - Grande Mesquita", lat: 13.9054, lon: -4.555 },
      { name: "Timbuktu - Mesquita Djinguereber", lat: 16.7735, lon: -3.0074 },
    ],
  },
  col: {
    summary:
      "A Colômbia fica no norte da América do Sul. Tem montanhas, florestas, praias no Caribe e no Pacífico, café, cidades coloridas e muita dança.",
    music: "Cumbia, vallenato e bambuco são sons colombianos com tambores, acordeão, flautas e histórias cantadas.",
    landmarks: [
      { name: "Bogotá - Plaza de Bolívar", lat: 4.5981, lon: -74.0758 },
      { name: "Cartagena - cidade murada", lat: 10.4236, lon: -75.5505 },
      { name: "Medellín - Plaza Botero", lat: 6.2525, lon: -75.5683 },
    ],
  },
  eth: {
    summary:
      "A Etiópia fica no leste da África. Tem montanhas altas, igrejas antigas escavadas na pedra, café, muitos idiomas e um calendário próprio.",
    music: "A música etíope usa escalas especiais, canto, krar, masenqo e tambores; muitas melodias têm um balanço diferente do que se ouve em outros lugares.",
    landmarks: [
      { name: "Adis Abeba - Museu Nacional", lat: 9.0388, lon: 38.7616 },
      { name: "Lalibela - igrejas escavadas", lat: 12.0316, lon: 39.0476 },
      { name: "Gondar - Fasil Ghebbi", lat: 12.6076, lon: 37.4697 },
    ],
  },
  mrt: {
    summary:
      "A Mauritânia fica no noroeste da África. Tem muito Saara, cidades-oásis, caravanas, costa no Atlântico e trens enormes levando minério pelo deserto.",
    music: "A música mauritana usa canto poético, tidinit, ardine e ritmos do deserto, muitas vezes guardados por famílias de músicos.",
    landmarks: [
      { name: "Nouakchott - mercado de peixes", lat: 18.0858, lon: -15.9785 },
      { name: "Chinguetti - cidade antiga", lat: 20.463, lon: -12.362 },
      { name: "Parque Nacional Banc d'Arguin", lat: 20.234, lon: -16.108 },
    ],
  },
  tza: {
    summary:
      "A Tanzânia fica no leste da África. Tem savanas, o monte Kilimanjaro, ilhas como Zanzibar, muitos animais e povos com línguas e costumes diferentes.",
    music: "Na Tanzânia há taarab em Zanzibar, ngoma com tambores e danças, além de bongo flava nas cidades.",
    landmarks: [
      { name: "Dodoma - centro da capital", lat: -6.163, lon: 35.7516 },
      { name: "Monte Kilimanjaro", lat: -3.0674, lon: 37.3556 },
      { name: "Zanzibar - Stone Town", lat: -6.1622, lon: 39.1921 },
    ],
  },
  nga: {
    summary:
      "A Nigéria fica na África Ocidental e é o país com mais pessoas da África. Tem cidades enormes como Lagos, a capital Abuja, muitos idiomas, filmes de Nollywood, rios, mercados e petróleo.",
    music: "Na Nigéria há afrobeats, juju, highlife, fuji, tambores falantes e muitos ritmos que fazem as cidades dançarem.",
    landmarks: [
      { name: "Abuja - Mesquita Nacional", lat: 9.0579, lon: 7.4891 },
      { name: "Lagos - National Theatre", lat: 6.4769, lon: 3.3703 },
      { name: "Olumo Rock", lat: 7.1611, lon: 3.3486 },
    ],
  },
  ven: {
    summary:
      "A Venezuela fica no norte da América do Sul, com costa no Caribe, planícies chamadas llanos, petróleo, montanhas e o Salto Ángel, a cachoeira mais alta do mundo.",
    music: "O joropo é uma música venezuelana ligada aos llanos, com harpa, cuatro, maracas e dança rápida.",
    landmarks: [
      { name: "Caracas - Plaza Bolívar", lat: 10.5061, lon: -66.9146 },
      { name: "Salto Ángel", lat: 5.9675, lon: -62.5356 },
      { name: "Canaima - lagoa e quedas", lat: 6.2411, lon: -62.8548 },
    ],
  },
  pak: {
    summary:
      "O Paquistão fica no sul da Ásia. Tem o rio Indo, montanhas altíssimas, desertos, campos de trigo, cidades como Karachi e Lahore, tecidos coloridos e muita paixão por críquete.",
    music: "Qawwali, ghazal e músicas folclóricas usam vozes fortes, tabla, harmônio e palmas para criar canções cheias de energia.",
    landmarks: [
      { name: "Islamabad - Mesquita Faisal", lat: 33.7294, lon: 73.0371 },
      { name: "Lahore - Forte de Lahore", lat: 31.5889, lon: 74.3159 },
      { name: "Karachi - Mausoléu Mazar-e-Quaid", lat: 24.8758, lon: 67.0408 },
    ],
  },
  nam: {
    summary:
      "A Namíbia fica no sudoeste da África. Tem dunas gigantes no deserto do Namibe, costa com neblina, animais selvagens, povos antigos e lugares onde o céu parece muito grande.",
    music: "Na Namíbia há cantos em grupo, tambores, danças de comunidades locais e músicas modernas como oviritje e kwaito namibiano.",
    landmarks: [
      { name: "Windhoek - Christuskirche", lat: -22.5674, lon: 17.0877 },
      { name: "Sossusvlei - dunas vermelhas", lat: -24.7397, lon: 15.2867 },
      { name: "Swakopmund - Mole", lat: -22.6789, lon: 14.5272 },
    ],
  },
  moz: {
    summary:
      "Moçambique fica na costa leste da África, de frente para o oceano Índico. Fala português, tem praias, ilhas, Maputo, mercados, carvão, gás natural e muita vida perto do mar.",
    music: "Marrabenta, timbila, tufo e ritmos de dança misturam xilos, tambores, guitarras e vozes de festas populares.",
    landmarks: [
      { name: "Maputo - Estação Central", lat: -25.9681, lon: 32.5729 },
      { name: "Ilha de Moçambique", lat: -15.0348, lon: 40.7358 },
      { name: "Arquipélago de Bazaruto", lat: -21.655, lon: 35.46 },
    ],
  },
  zmb: {
    summary:
      "A Zâmbia fica no sul da África. Tem savanas, rios, cobre no subsolo, muitas línguas e as Cataratas Vitória, onde a água cai fazendo uma nuvem de spray.",
    music: "Kalindula, tambores, coros e canções de dança aparecem em festas e contam histórias das comunidades zambianas.",
    landmarks: [
      { name: "Lusaka - National Museum", lat: -15.4234, lon: 28.2921 },
      { name: "Cataratas Vitória - lado da Zâmbia", lat: -17.9243, lon: 25.8572 },
      { name: "Parque Nacional South Luangwa", lat: -13.0576, lon: 31.6932 },
    ],
  },
  mmr: {
    summary:
      "Myanmar fica no sudeste da Ásia. Tem o rio Irauádi, pagodes dourados, arrozais, montanhas, muitos povos diferentes e cidades cheias de templos.",
    music: "A música birmanesa usa a harpa saung, gongos, tambores e conjuntos hsaing waing com sons rápidos e brilhantes.",
    landmarks: [
      { name: "Naypyidaw - Uppatasanti Pagoda", lat: 19.7633, lon: 96.0785 },
      { name: "Yangon - Pagode Shwedagon", lat: 16.7983, lon: 96.1496 },
      { name: "Bagan - templos antigos", lat: 21.1717, lon: 94.8585 },
    ],
  },
  som: {
    summary:
      "A Somália fica no Chifre da África e tem uma costa muito longa no oceano Índico. Tem camelos, barcos, desertos, poesia oral e cidades antigas de comércio.",
    music: "A música somali mistura poesia cantada, oud, tambores, palmas e melodias que muitas vezes contam histórias de coragem e família.",
    landmarks: [
      { name: "Mogadíscio - Arco do Triunfo", lat: 2.0367, lon: 45.3421 },
      { name: "Laas Geel - pinturas rupestres", lat: 9.7803, lon: 44.4619 },
      { name: "Berbera - cidade costeira", lat: 10.4396, lon: 45.0143 },
    ],
  },
  caf: {
    summary:
      "A República Centro-Africana fica bem no meio da África. Tem florestas, savanas, rios, diamantes, ouro e povos que conhecem muito bem os sons da natureza.",
    music: "Há cantos em grupo, tambores e polifonias de povos da floresta, em que várias vozes se encaixam como peças de música.",
    landmarks: [
      { name: "Bangui - Catedral Notre-Dame", lat: 4.3654, lon: 18.5587 },
      { name: "Bangui - Mercado Central", lat: 4.374, lon: 18.562 },
      { name: "Cachoeiras de Boali", lat: 4.8855, lon: 18.0431 },
    ],
  },
  ssd: {
    summary:
      "O Sudão do Sul é um país jovem no leste da África. O rio Nilo passa por lá, há grandes áreas alagadas, gado importante para muitas famílias e muitas línguas locais.",
    music: "Canções com tambores, palmas e coros aparecem em festas, cerimônias e histórias de comunidades do Nilo e das savanas.",
    landmarks: [
      { name: "Juba - Ponte sobre o Nilo", lat: 4.8487, lon: 31.6046 },
      { name: "Juba - Catedral de Santa Teresa", lat: 4.8466, lon: 31.6118 },
      { name: "Sudd - pântanos do Nilo", lat: 7.5, lon: 31.5 },
    ],
  },
  ukr: {
    summary:
      "A Ucrânia fica no leste da Europa. Tem campos grandes de trigo e girassol, cidades antigas como Kyiv, montanhas nos Cárpatos, mar Negro e muita história de resistência.",
    music: "A bandura, os coros e as canções folclóricas ucranianas são conhecidos por melodias fortes, às vezes alegres e às vezes bem emocionadas.",
    landmarks: [
      { name: "Kyiv - Praça da Independência", lat: 50.45, lon: 30.5233 },
      { name: "Lviv - Praça Rynok", lat: 49.8419, lon: 24.0315 },
      { name: "Cárpatos - Hoverla", lat: 48.1607, lon: 24.5001 },
    ],
  },
  mdg: {
    summary:
      "Madagascar é uma ilha grande perto da África. Tem lêmures, baobás, camaleões, arrozais, montanhas e muitos animais que quase não existem em outro lugar.",
    music: "A valiha, uma espécie de cítara de bambu, aparece em músicas malgaxes junto com canto, palmas e ritmos de dança.",
    landmarks: [
      { name: "Antananarivo - Rova", lat: -18.9237, lon: 47.5322 },
      { name: "Avenida dos Baobás", lat: -20.2508, lon: 44.4197 },
      { name: "Parque Nacional Isalo", lat: -22.55, lon: 45.4 },
    ],
  },
  cze: {
    summary:
      "A Chéquia tem castelos, pontes antigas, praças bonitas e cidades que parecem cenário de conto.",
    music: "A música checa tem polcas, corais e compositores clássicos famosos.",
    landmarks: [
      { name: "Praga - Ponte Carlos", lat: 50.0865, lon: 14.4114 },
      { name: "Praga - Castelo", lat: 50.0911, lon: 14.4016 },
      { name: "Český Krumlov", lat: 48.8127, lon: 14.3175 },
    ],
  },
  cyp: {
    summary:
      "Chipre é uma ilha no mar Mediterrâneo. Tem praias, sítios antigos e cidades com muitas histórias.",
    music: "A música cipriota mistura sons gregos, turcos e instrumentos de corda.",
    landmarks: [
      { name: "Nicósia - Portão de Famagusta", lat: 35.1742, lon: 33.3692 },
      { name: "Pafos - Parque Arqueológico", lat: 34.7564, lon: 32.4066 },
      { name: "Larnaca - Igreja de São Lázaro", lat: 34.9114, lon: 33.6356 },
    ],
  },
  vat: {
    summary:
      "A Cidade do Vaticano é o menor país do mundo. Fica dentro de Roma e tem igrejas, museus e obras de arte.",
    music: "No Vaticano há canto coral e música sacra tocada em igrejas.",
    landmarks: [
      { name: "Basílica de São Pedro", lat: 41.9022, lon: 12.4539 },
      { name: "Praça de São Pedro", lat: 41.9022, lon: 12.4573 },
      { name: "Museus Vaticanos", lat: 41.9065, lon: 12.4536 },
    ],
  },
};

const COUNTRY_AUDIO = {
  rus: {
    greeting: {
      phrase: "Здравствуйте",
      language: "russo",
      translation: "Uma forma educada de dizer olá.",
      file: "CPIDL Russian - Zdravstvujte.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Canção dos barqueiros do Volga",
      description: "Uma canção popular russa antiga, com voz profunda e clima de trabalho no rio.",
      file: "Feodor Chaliapin - Song of the Volga Boatmen - Victor 14901A.ogg",
      credit: "Wikimedia Commons",
    },
  },
  bra: {
    greeting: {
      phrase: "Bom dia",
      language: "português",
      translation: "Um jeito carinhoso de dizer bom dia.",
      file: "Pt-br (Koehne)-bom dia.mp3",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Samba de fato",
      description: "Um samba brasileiro antigo, com ritmo de dança e história popular.",
      file: "Samba de fato 1932.ogg",
      credit: "Wikimedia Commons",
    },
  },
  arg: {
    greeting: {
      phrase: "Buenos días",
      language: "espanhol",
      translation: "Quer dizer bom dia.",
      file: "LL-Q1321 (spa)-Rodrigo5260-buenos días.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Tango rioplatense",
      description: "Uma amostra de tango, música ligada a Buenos Aires e à região do Rio da Prata.",
      file: "PDP-UY - Arturo de Nava, baritone solo with guitar - Tango de los negros - Victor-62206a-f87.flac",
      credit: "Wikimedia Commons",
    },
  },
  per: {
    greeting: {
      phrase: "Buenos días",
      language: "espanhol",
      translation: "Quer dizer bom dia.",
      file: "LL-Q1321 (spa)-Rodrigo5260-buenos días.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Serranita - Huaynito",
      description: "Um huayno andino antigo, com som que lembra as montanhas dos Andes.",
      file: "Serranita - Huaynito - Escobedo y Núñez - Lima 22 Septiembre 1913.ogg",
      credit: "Wikimedia Commons",
    },
  },
  lby: {
    greeting: {
      phrase: "صباح الخير",
      language: "árabe",
      translation: "Quer dizer bom dia.",
      file: "Ṣabāḥ al-kháyr2.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Música líbia",
      description: "Cantos, palmas, tambores e poesia aparecem em tradições líbias do deserto e do Mediterrâneo. O áudio ainda está em curadoria.",
    },
  },
  irn: {
    greeting: {
      phrase: "سلام",
      language: "persa",
      translation: "Quer dizer olá ou paz.",
      file: "Salām.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Música persa",
      description: "Tar, setar, santur, ney e tombak aparecem em muitas tradições musicais do Irã. O áudio ainda está em curadoria.",
    },
  },
  mng: {
    greeting: {
      phrase: "Сайн байна уу",
      language: "mongol",
      translation: "Um jeito educado de dizer olá.",
    },
    music: {
      title: "Morin khuur e canto de garganta",
      description: "O morin khuur é um instrumento de cordas, e o canto de garganta pode fazer sons graves e agudos ao mesmo tempo.",
    },
  },
  ven: {
    greeting: {
      phrase: "Buenos días",
      language: "espanhol",
      translation: "Quer dizer bom dia.",
      file: "LL-Q1321 (spa)-Rodrigo5260-buenos días.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Alma Llanera no arpa",
      description: "Uma melodia llanera tocada no arpa, instrumento muito lembrado nos llanos.",
      file: "Alma Llanera - Instrumental al arpa.ogg",
      credit: "Wikimedia Commons",
    },
  },
  usa: {
    greeting: {
      phrase: "Good morning",
      language: "inglês",
      translation: "Quer dizer bom dia.",
      file: "En-uk-good morning.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Flauta nativa norte-americana",
      description: "Um som de flauta ligado a povos indígenas da América do Norte.",
      file: "Native American Flute.ogg",
      credit: "Wikimedia Commons",
    },
  },
  can: {
    greeting: {
      phrase: "Comment ça va?",
      language: "francês",
      translation: "Quer dizer como vai?",
      file: "LL-Q150 (fra)-LoquaxFR-comment ça va.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Tambores e cantos First Nations",
      description: "Um registro de Pow-Wow no Canadá, com tambores e vozes em grupo.",
      file: "AUDIO First Nations Pow-Wow Drums and singers stereo.ogg",
      credit: "Wikimedia Commons",
    },
  },
  mex: {
    greeting: {
      phrase: "Buenos días",
      language: "espanhol",
      translation: "Quer dizer bom dia.",
      file: "LL-Q1321 (spa)-Rodrigo5260-buenos días.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Son jarocho - La Bamba",
      description: "Um trecho de son jarocho, tradição musical de Veracruz.",
      file: "Yacatecuhtli, Son jarocho toca la Bamba.ogv",
      credit: "Wikimedia Commons",
    },
  },
  fra: {
    greeting: {
      phrase: "Comment ça va?",
      language: "francês",
      translation: "Quer dizer como vai?",
      file: "LL-Q150 (fra)-LoquaxFR-comment ça va.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Chanson réaliste",
      description: "Uma canção francesa urbana, estilo que conta histórias com voz bem expressiva.",
      file: "J'ai soif, Chanson réaliste.ogg",
      credit: "Wikimedia Commons",
    },
  },
  esp: {
    greeting: {
      phrase: "Buenos días",
      language: "espanhol",
      translation: "Quer dizer bom dia.",
      file: "LL-Q1321 (spa)-Rodrigo5260-buenos días.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Amostra de flamenco",
      description: "Flamenco com violão e ritmo forte, muito associado à Andaluzia.",
      file: "Flamenco sample by FRANCISCOKEEP.ogg",
      credit: "Wikimedia Commons",
    },
  },
  prt: {
    greeting: {
      phrase: "Bom dia",
      language: "português",
      translation: "Um jeito carinhoso de dizer bom dia.",
      file: "LL-Q5146 (por)-Nelson Ricardo 2500-Bom dia..wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Tic Tac Fado Instrumental",
      description: "Uma amostra instrumental de fado, tradição portuguesa cheia de sentimento.",
      file: "Tic Tac Fado Instrumental.ogg",
      credit: "Wikimedia Commons",
    },
  },
  ita: {
    greeting: {
      phrase: "Come stai?",
      language: "italiano",
      translation: "Quer dizer como vai?",
      file: "It-come stai.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Tarantella napoletana",
      description: "Uma tarantella italiana, dança rápida e alegre do sul da Itália.",
      file: "Tarantella.ogg",
      credit: "Wikimedia Commons",
    },
  },
  irl: {
    greeting: {
      phrase: "Good morning",
      language: "inglês",
      translation: "Quer dizer bom dia.",
      file: "En-uk-good morning.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "The Mountain Road",
      description: "Um reel irlandês tocado no bouzouki, com ritmo de dança tradicional.",
      file: "The Mountain Road - Medium - Bouzouki.ogg",
      credit: "Wikimedia Commons",
    },
  },
  chn: {
    greeting: {
      phrase: "你好吗?",
      language: "mandarim",
      translation: "Quer dizer como vai?",
      file: "LL-Q9192 (cmn)-Luilui6666-你好吗?.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Yangguan Sandie no guqin",
      description: "Uma peça tocada no guqin, instrumento chinês muito antigo.",
      file: "Guqin-Yangguan Sandie.ogg",
      credit: "Wikimedia Commons",
    },
  },
  ind: {
    greeting: {
      phrase: "नमस्ते",
      language: "híndi",
      translation: "Uma saudação respeitosa, como olá.",
      file: "LL-Q1568 (hin)-QueerEcofeminist-नमस्ते.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Sitar e tabla",
      description: "Uma amostra com sitar e tabla, dois sons muito lembrados na música clássica indiana.",
      file: "Sitar and tabla rendition - Freedom Jam, 2015.oga",
      credit: "Wikimedia Commons",
    },
  },
  jpn: {
    greeting: {
      phrase: "こんにちは",
      language: "japonês",
      translation: "Quer dizer olá ou boa tarde.",
      file: "Ja-konnichiwa.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Koto",
      description: "Uma apresentação de koto, instrumento japonês de cordas.",
      file: "Koto performance.ogg",
      credit: "Wikimedia Commons",
    },
  },
  aus: {
    greeting: {
      phrase: "Good morning",
      language: "inglês",
      translation: "Quer dizer bom dia.",
      file: "En-uk-good morning.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Didgeridoo",
      description: "Uma amostra de didgeridoo, instrumento ligado a povos aborígenes da Austrália.",
      file: "Hidden Tribe - Didgeridoo 1 Live.ogg",
      credit: "Wikimedia Commons",
    },
  },
  kaz: {
    greeting: {
      phrase: "Сәлеметсіз бе",
      language: "cazaque",
      translation: "Uma forma educada de dizer olá.",
    },
    music: {
      title: "Dombra",
      description: "O dombra é um instrumento de duas cordas usado para contar histórias e tocar melodias das estepes.",
    },
  },
  dza: {
    greeting: {
      phrase: "صباح الخير",
      language: "árabe",
      translation: "Quer dizer bom dia.",
      file: "Ṣabāḥ al-kháyr2.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Bedoui / raï argelino",
      description: "Uma gravação tradicional argelina ligada ao bedoui e ao raï.",
      file: "Goul El Si Mohamed 2 (algerian bedoui rai music).ogg",
      credit: "Wikimedia Commons",
    },
  },
  tcd: {
    greeting: {
      phrase: "صباح الخير",
      language: "árabe",
      translation: "Quer dizer bom dia. No Chade também se fala francês e muitas línguas locais.",
      file: "Ṣabāḥ al-kháyr2.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Ritmos do Chade",
      description: "Tambores, flautas, cordas e cantos aparecem em muitas comunidades do Chade. O áudio ainda está em curadoria.",
    },
  },
  cod: {
    greeting: {
      phrase: "Comment ça va?",
      language: "francês",
      translation: "Quer dizer como vai? A RD Congo também tem muitas línguas nacionais.",
      file: "LL-Q150 (fra)-LoquaxFR-comment ça va.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Rumba congolesa",
      description: "A rumba congolesa e o soukous são músicas de guitarras, vozes e dança. O áudio ainda está em curadoria.",
    },
  },
  sau: {
    greeting: {
      phrase: "صباح الخير",
      language: "árabe",
      translation: "Quer dizer bom dia.",
      file: "Ṣabāḥ al-kháyr2.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Ardah",
      description: "A ardah é uma dança e música saudita com canto, palmas, tambores e pessoas em grupo. O áudio ainda está em curadoria.",
    },
  },
  idn: {
    greeting: {
      phrase: "Selamat pagi",
      language: "indonésio",
      translation: "Quer dizer bom dia.",
      file: "LL-Q9240 (ind)-Xbypass-selamat pagi.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Gamelan javanês",
      description: "Gamelan com gongos e metalofones, tocado por músicos do palácio de Yogyakarta.",
      file: "Gamelan angka 1 Kraton Ngayogyakarta.ogg",
      credit: "Wikimedia Commons",
    },
  },
  sdn: {
    greeting: {
      phrase: "صباح الخير",
      language: "árabe",
      translation: "Quer dizer bom dia.",
      file: "Ṣabāḥ al-kháyr2.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Música sudanesa",
      description: "Cantos, tambores, palmas e oud aparecem em muitas tradições do Sudão. O áudio ainda está em curadoria.",
    },
  },
  ner: {
    greeting: {
      phrase: "Comment ça va?",
      language: "francês",
      translation: "Quer dizer como vai? No Níger também se falam muitas línguas locais.",
      file: "LL-Q150 (fra)-LoquaxFR-comment ça va.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Guitarras e ritmos do Sahel",
      description: "No Níger há tradições haúsa, zarma-songhai, tuaregues e fulas com canto, tambores e guitarras do deserto.",
    },
  },
  ago: {
    greeting: {
      phrase: "Bom dia",
      language: "português",
      translation: "Um jeito de desejar uma boa manhã.",
      file: "Pt-br (Koehne)-bom dia.mp3",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Semba, kizomba e kuduro",
      description: "Ritmos angolanos com dança, batidas urbanas e histórias de festa, família e cidade. O áudio ainda está em curadoria.",
    },
  },
  mli: {
    greeting: {
      phrase: "Comment ça va?",
      language: "francês",
      translation: "Quer dizer como vai? No Mali também se falam bambara e muitas línguas locais.",
      file: "LL-Q150 (fra)-LoquaxFR-comment ça va.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Kora, ngoni e griôs",
      description: "A música do Mali usa cordas, balafon, tambores e vozes que guardam histórias de famílias e viajantes.",
    },
  },
  zaf: {
    greeting: {
      phrase: "Sawubona",
      language: "zulu",
      translation: "Quer dizer olá.",
    },
    music: {
      title: "Coros e ritmos sul-africanos",
      description: "Coros, percussão, jazz, gospel, mbaqanga e kwaito mostram muitos jeitos sul-africanos de cantar e dançar.",
    },
  },
  col: {
    greeting: {
      phrase: "Buenos días",
      language: "espanhol",
      translation: "Quer dizer bom dia.",
      file: "LL-Q1321 (spa)-Rodrigo5260-buenos días.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Cumbia e vallenato",
      description: "Cumbia e vallenato usam tambores, acordeão, flautas e canto para festas e histórias colombianas.",
    },
  },
  eth: {
    greeting: {
      phrase: "ሰላም",
      language: "amárico",
      translation: "Quer dizer olá ou paz.",
    },
    music: {
      title: "Krar e masenqo",
      description: "A música etíope usa escalas especiais e instrumentos como krar, masenqo e tambores.",
    },
  },
  bol: {
    greeting: {
      phrase: "Buenos días",
      language: "espanhol",
      translation: "Quer dizer bom dia.",
      file: "LL-Q1321 (spa)-Rodrigo5260-buenos días.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Sons andinos",
      description: "Flautas andinas, charango e tambores aparecem em danças como morenada, caporales e tinku.",
    },
  },
  mrt: {
    greeting: {
      phrase: "صباح الخير",
      language: "árabe",
      translation: "Quer dizer bom dia.",
      file: "Ṣabāḥ al-kháyr2.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Tidinit e ardine",
      description: "A música mauritana usa canto poético, tidinit, ardine e ritmos do deserto.",
    },
  },
  egy: {
    greeting: {
      phrase: "صباح الخير",
      language: "árabe",
      translation: "Quer dizer bom dia.",
      file: "Ṣabāḥ al-kháyr2.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Oud e percussão egípcia",
      description: "A música egípcia usa voz, percussão, flautas e oud em sons populares, clássicos e modernos.",
    },
  },
  tza: {
    greeting: {
      phrase: "Habari",
      language: "suaíli",
      translation: "Um jeito de perguntar notícias ou dizer olá.",
    },
    music: {
      title: "Taarab, ngoma e bongo flava",
      description: "Taarab, tambores ngoma e bongo flava mostram sons das ilhas, aldeias e cidades da Tanzânia.",
    },
  },
  nga: {
    greeting: {
      phrase: "Good morning",
      language: "inglês",
      translation: "Quer dizer bom dia. Na Nigéria também se falam iorubá, haúsa, igbo e muitas outras línguas.",
      file: "En-uk-good morning.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Afrobeats, juju e highlife",
      description: "A Nigéria tem tambores falantes, guitarras, coros e ritmos modernos que influenciam músicas do mundo todo.",
    },
  },
  pak: {
    greeting: {
      phrase: "السلام علیکم",
      language: "urdu",
      translation: "Quer dizer que a paz esteja com você.",
    },
    music: {
      title: "Qawwali e tabla",
      description: "Qawwali usa vozes fortes, harmônio, tabla e palmas; muitas canções parecem uma conversa cantada.",
    },
  },
  nam: {
    greeting: {
      phrase: "Good morning",
      language: "inglês",
      translation: "Quer dizer bom dia. Na Namíbia também se falam oshiwambo, nama, afrikaans e outras línguas.",
      file: "En-uk-good morning.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Cantos, danças e oviritje",
      description: "A música namibiana mistura coros, palmas, dança, histórias de comunidades locais e estilos urbanos.",
    },
  },
  moz: {
    greeting: {
      phrase: "Bom dia",
      language: "português",
      translation: "Um jeito de desejar uma boa manhã. Moçambique também tem muitas línguas nacionais.",
    },
    music: {
      title: "Marrabenta e timbila",
      description: "Marrabenta tem guitarras e dança; timbila usa xilos de madeira tocados em conjunto.",
    },
  },
  tur: {
    greeting: {
      phrase: "Merhaba",
      language: "turco",
      translation: "Quer dizer olá.",
    },
    music: {
      title: "Saz, ney e darbuka",
      description: "A música turca pode ter cordas, flautas, percussão e ritmos de dança de várias regiões.",
    },
  },
  chl: {
    greeting: {
      phrase: "Buenos días",
      language: "espanhol",
      translation: "Quer dizer bom dia.",
      file: "LL-Q1321 (spa)-Rodrigo5260-buenos días.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Cueca chilena",
      description: "A cueca é uma dança com lenços, palmas, violão e um jeito brincalhão de se aproximar e se afastar.",
    },
  },
  zmb: {
    greeting: {
      phrase: "Good morning",
      language: "inglês",
      translation: "Quer dizer bom dia. A Zâmbia também tem muitas línguas nacionais.",
      file: "En-uk-good morning.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Kalindula e coros",
      description: "Kalindula usa guitarra, baixo, percussão e canto para músicas de dança e histórias locais.",
    },
  },
  mmr: {
    greeting: {
      phrase: "မင်္ဂလာပါ",
      language: "birmanês",
      translation: "Quer dizer olá, como uma saudação de bons desejos.",
    },
    music: {
      title: "Saung e hsaing waing",
      description: "A harpa saung e conjuntos de gongos e tambores criam sons brilhantes em Myanmar.",
    },
  },
  afg: {
    greeting: {
      phrase: "سلام",
      language: "dari",
      translation: "Quer dizer olá ou paz.",
      file: "Salām.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Rubab e tabla",
      description: "O rubab é um instrumento de cordas muito lembrado no Afeganistão, acompanhado por tabla e canto.",
    },
  },
  som: {
    greeting: {
      phrase: "Iska warran?",
      language: "somali",
      translation: "Quer dizer como vão as notícias? É uma forma de perguntar como a pessoa está.",
    },
    music: {
      title: "Poesia cantada somali",
      description: "A música somali usa poesia, oud, tambores, palmas e melodias que contam histórias.",
    },
  },
  caf: {
    greeting: {
      phrase: "Comment ça va?",
      language: "francês",
      translation: "Quer dizer como vai? Também se fala sango e muitas línguas locais.",
      file: "LL-Q150 (fra)-LoquaxFR-comment ça va.wav",
      credit: "Lingua Libre / Wikimedia Commons",
    },
    music: {
      title: "Cantos da floresta e tambores",
      description: "Vozes em grupo, palmas e tambores podem formar músicas em que cada pessoa encaixa uma parte.",
    },
  },
  ssd: {
    greeting: {
      phrase: "Good morning",
      language: "inglês",
      translation: "Quer dizer bom dia. O Sudão do Sul também tem muitas línguas locais.",
      file: "En-uk-good morning.ogg",
      credit: "Wikimedia Commons",
    },
    music: {
      title: "Tambores e coros do Nilo",
      description: "Muitas músicas do Sudão do Sul usam tambores, palmas e canto em grupo para festas e cerimônias.",
    },
  },
  ukr: {
    greeting: {
      phrase: "Добрий день",
      language: "ucraniano",
      translation: "Quer dizer bom dia ou boa tarde.",
    },
    music: {
      title: "Bandura e coros ucranianos",
      description: "A bandura tem muitas cordas e acompanha canções que podem soar doces, fortes ou emocionadas.",
    },
  },
  mdg: {
    greeting: {
      phrase: "Manao ahoana?",
      language: "malgaxe",
      translation: "Quer dizer como vai?",
    },
    music: {
      title: "Valiha e hiragasy",
      description: "A valiha é um instrumento de bambu; o hiragasy mistura música, dança e histórias apresentadas em grupo.",
    },
  },
};

const COUNTRY_EXPORTS = {
  rus: ["petróleo", "gás natural", "trigo", "metais", "fertilizantes"],
  bra: ["soja", "minério de ferro", "petróleo", "café", "carne"],
  jpn: ["carros", "máquinas", "eletrônicos", "peças de veículos", "robótica"],
  egy: ["gás natural", "petróleo", "fertilizantes", "têxteis", "frutas cítricas"],
  ken: ["chá", "café", "flores", "hortaliças", "roupas"],
  fra: ["aviões", "remédios", "vinhos", "perfumes", "queijos"],
  aus: ["minério de ferro", "carvão", "gás natural", "ouro", "trigo"],
  usa: ["aviões", "máquinas", "eletrônicos", "carros", "soja"],
  can: ["petróleo", "gás natural", "madeira", "trigo", "carros"],
  mex: ["carros", "peças de veículos", "eletrônicos", "petróleo", "cerveja"],
  arg: ["soja", "milho", "trigo", "carne", "vinho"],
  chl: ["cobre", "frutas", "peixes", "vinho", "celulose"],
  per: ["cobre", "ouro", "zinco", "uvas", "café"],
  nga: ["petróleo", "gás natural", "cacau", "sementes de gergelim", "fertilizantes"],
  ven: ["petróleo", "ouro", "metanol", "ferro", "cacau"],
  pak: ["roupas", "tecidos", "arroz", "algodão", "instrumentos cirúrgicos"],
  nam: ["diamantes", "urânio", "peixes", "carne bovina", "cobre"],
  moz: ["carvão", "alumínio", "gás natural", "eletricidade", "castanha de caju"],
  lby: ["petróleo", "gás natural", "produtos petroquímicos", "ferro", "tâmaras"],
  irn: ["petróleo", "produtos petroquímicos", "pistache", "tapetes", "aço"],
  mng: ["carvão", "cobre", "ouro", "caxemira", "carne"],
  gbr: ["carros", "remédios", "máquinas", "ouro", "bebidas"],
  deu: ["carros", "máquinas", "remédios", "produtos químicos", "peças de veículos"],
  ita: ["máquinas", "carros", "remédios", "moda", "vinhos"],
  esp: ["carros", "alimentos", "remédios", "máquinas", "azeite"],
  prt: ["carros", "roupas", "calçados", "vinhos", "cortiça"],
  chn: ["eletrônicos", "máquinas", "brinquedos", "roupas", "móveis"],
  ind: ["remédios", "petróleo refinado", "diamantes", "arroz", "roupas"],
  zaf: ["ouro", "platina", "carros", "minério de ferro", "frutas"],
  col: ["petróleo", "carvão", "café", "flores", "banana"],
  eth: ["café", "flores", "gergelim", "ouro", "leguminosas"],
  mar: ["fertilizantes", "carros", "roupas", "peixes", "frutas"],
  ner: ["urânio", "ouro", "gado", "cebola", "feijão-fradinho"],
  mli: ["ouro", "algodão", "gado", "gergelim", "manga"],
  tur: ["carros", "roupas", "máquinas", "aço", "alimentos"],
  zmb: ["cobre", "cobalto", "tabaco", "açúcar", "flores"],
  mmr: ["gás natural", "roupas", "arroz", "feijão", "madeira"],
  som: ["gado", "banana", "peixes", "goma e resinas", "gergelim"],
  caf: ["ouro", "diamantes", "madeira", "algodão", "café"],
  ssd: ["petróleo", "gado", "goma arábica", "madeira", "sementes oleaginosas"],
  ukr: ["grãos", "óleo de girassol", "minério de ferro", "aço", "máquinas"],
  mdg: ["baunilha", "níquel", "cobalto", "cravo", "roupas"],
  kor: ["semicondutores", "carros", "navios", "eletrônicos", "máquinas"],
  idn: ["carvão", "óleo de palma", "gás natural", "níquel", "borracha"],
  afg: ["carvão", "tapetes", "frutas secas", "uva-passa", "plantas medicinais"],
  ala: ["serviços marítimos", "peixes", "alimentos", "navios", "produtos de madeira"],
  alb: ["roupas", "calçados", "minérios", "petróleo", "frutas"],
  and: ["tabaco", "bebidas", "perfumes", "produtos de turismo", "artesanato"],
  ago: ["petróleo", "diamantes", "gás natural", "peixes", "madeira"],
  aia: ["lagosta", "peixes", "sal", "bebidas", "serviços de turismo"],
  ata: ["pesquisa científica", "dados climáticos", "cooperação internacional", "educação", "conhecimento sobre o gelo"],
  atg: ["serviços de turismo", "rum", "lagosta", "peixes", "artesanato"],
  sau: ["petróleo", "produtos petroquímicos", "plásticos", "fertilizantes", "tâmaras"],
  dza: ["gás natural", "petróleo", "fertilizantes", "amônia", "tâmaras"],
  arm: ["cobre", "ouro", "diamantes lapidados", "bebidas", "frutas"],
  abw: ["produtos de petróleo", "bebidas", "aloe vera", "peixes", "serviços de turismo"],
  aut: ["máquinas", "carros", "remédios", "aço", "instrumentos médicos"],
  aze: ["petróleo", "gás natural", "algodão", "frutas", "produtos químicos"],
  bhs: ["serviços de turismo", "produtos de petróleo", "rum", "peixes", "sal"],
  bhr: ["alumínio", "petróleo refinado", "produtos petroquímicos", "pérolas", "serviços financeiros"],
  bgd: ["roupas", "tecidos", "calçados", "couro", "peixes"],
  brb: ["rum", "açúcar", "produtos químicos", "alimentos", "serviços de turismo"],
  bel: ["remédios", "carros", "diamantes", "produtos químicos", "chocolate"],
  blz: ["açúcar", "banana", "frutas cítricas", "peixes", "madeira"],
  ben: ["algodão", "castanha de caju", "sementes oleaginosas", "abacaxi", "óleo de palma"],
  bmu: ["serviços financeiros", "serviços de seguros", "produtos farmacêuticos", "rum", "serviços de turismo"],
  blr: ["fertilizantes", "máquinas", "petróleo refinado", "laticínios", "madeira"],
  bol: ["gás natural", "zinco", "ouro", "soja", "estanho"],
  bih: ["metais", "móveis", "madeira", "calçados", "roupas"],
  bwa: ["diamantes", "cobre", "níquel", "carne bovina", "soda ash"],
  brn: ["petróleo", "gás natural", "metanol", "produtos químicos", "serviços de energia"],
  bgr: ["máquinas", "cobre", "trigo", "remédios", "óleo de girassol"],
  bfa: ["ouro", "algodão", "castanha de caju", "gergelim", "animais"],
  bdi: ["café", "chá", "ouro", "algodão", "peles"],
  btn: ["eletricidade", "ferro-silício", "cimento", "frutas", "artesanato"],
  cpv: ["peixes", "roupas", "calçados", "serviços de turismo", "bebidas"],
  cmr: ["petróleo", "cacau", "madeira", "banana", "alumínio"],
  khm: ["roupas", "calçados", "arroz", "borracha", "bicicletas"],
  qat: ["gás natural", "petróleo", "fertilizantes", "plásticos", "alumínio"],
  kaz: ["petróleo", "urânio", "cobre", "trigo", "ferro"],
  cod: ["cobalto", "cobre", "diamantes", "ouro", "café"],
  sdn: ["ouro", "gergelim", "gado", "goma arábica", "algodão"],
  tcd: ["petróleo", "algodão", "gado", "goma arábica", "gergelim"],
  mrt: ["minério de ferro", "ouro", "peixes", "cobre", "gado"],
  tza: ["ouro", "castanha de caju", "café", "tabaco", "algodão"],
  cze: ["carros", "máquinas", "eletrônicos", "peças de veículos", "cerveja"],
  cyp: ["remédios", "queijo halloumi", "frutas cítricas", "batatas", "serviços de turismo"],
  vat: ["selos", "moedas", "publicações", "lembranças religiosas", "ingressos de museus"],
};
