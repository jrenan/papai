const { traits, species, habitats } = GAME_DATA;
const missions = GAME_DATA.missions.map(createMission);

const feedbackByLevel = {
  good: {
    badge: "🌟",
    title: "Combina muito!",
    text: "Você investigou bem. Este lugar tem as pistas certas.",
  },
  ok: {
    badge: "🤔",
    title: "Combina um pouco.",
    text: "Tem algumas pistas boas, mas ainda falta algo importante.",
  },
  low: {
    badge: "💛",
    title: "Aqui está difícil.",
    text: "Este lugar não tem as condições que ele mais precisa.",
  },
};

const startButton = document.querySelector("#startButton");
const restartButton = document.querySelector("#restartButton");
const voiceButton = document.querySelector("#voiceButton");
const gameHub = document.querySelector("#gameHub");
const worldGame = document.querySelector("#worldGame");
const gameOpenButtons = document.querySelectorAll("[data-open-game]");
const backHubButtons = document.querySelectorAll("[data-back-hub]");
const heroCard = document.querySelector(".hero-card");
const biomeScreens = document.querySelectorAll(".biome-screen");
const biomeMap = document.querySelector("#biomeMap");
const biomeRegions = document.querySelector("#biomeRegions");
const biomeMapLabels = document.querySelector("#biomeMapLabels");
const biomeInfo = document.querySelector("#biomeInfo");
const biomeInfoTitle = document.querySelector("#biomeInfoTitle");
const biomeInfoImage = document.querySelector("#biomeInfoImage");
const biomeInfoShort = document.querySelector("#biomeInfoShort");
const biomeInfoFacts = document.querySelector("#biomeInfoFacts");
const biomeInfoStory = document.querySelector("#biomeInfoStory");
const mission = document.querySelector("#mission");
const completeCard = document.querySelector("#completeCard");
const roundLabel = document.querySelector("#roundLabel");
const missionTitle = document.querySelector("#missionTitle");
const narration = document.querySelector("#narration");
const clues = document.querySelector("#clues");
const environmentArt = document.querySelector("#environmentArt");
const choiceGrid = document.querySelector("#choiceGrid");
const feedback = document.querySelector("#feedback");
const feedbackBadge = document.querySelector("#feedbackBadge");
const feedbackTitle = document.querySelector("#feedbackTitle");
const feedbackText = document.querySelector("#feedbackText");
const adaptationCard = document.querySelector("#adaptationCard");
const adaptationQuestion = document.querySelector("#adaptationQuestion");
const adaptationOptions = document.querySelector("#adaptationOptions");
const tryAgainButton = document.querySelector("#tryAgainButton");
const nextButton = document.querySelector("#nextButton");
const countryStrip = document.querySelector("#countryStrip");
const countryFlag = document.querySelector("#countryFlag");
const countryRegion = document.querySelector("#countryRegion");
const countryName = document.querySelector("#countryName");
const countryPopulation = document.querySelector("#countryPopulation");
const countryCapital = document.querySelector("#countryCapital");
const countryExports = document.querySelector("#countryExports");
const countryHistory = document.querySelector("#countryHistory");
const countryMusic = document.querySelector("#countryMusic");
const landmarkList = document.querySelector("#landmarkList");
const streetViewFrame = document.querySelector("#streetViewFrame");
const mapsLink = document.querySelector("#mapsLink");
const streetViewLink = document.querySelector("#streetViewLink");
const musicButton = document.querySelector("#musicButton");
const globeCanvas = document.querySelector("#globeCanvas");
const globeStage = document.querySelector("#globeStage");
const vrButton = document.querySelector("#vrButton");
const pauseGlobeButton = document.querySelector("#pauseGlobeButton");
const toggleFlagsButton = document.querySelector("#toggleFlagsButton");
const dayNightLabel = document.querySelector("#dayNightLabel");
const countrySearch = document.querySelector("#countrySearch");
const sourceStatus = document.querySelector("#sourceStatus");
const globeControlButtons = document.querySelectorAll("[data-globe-control]");
const toggleCountryBrowser = document.querySelector("#toggleCountryBrowser");
const closeCountryBrowser = document.querySelector("#closeCountryBrowser");
const countryBrowser = document.querySelector("#countryBrowser");
const closeCountryPanel = document.querySelector("#closeCountryPanel");

const COUNTRY_DATA_URL =
  "data/world-countries.json";
const COUNTRY_POPULATION_URL = "data/country-by-population.json";
const COUNTRY_GEOJSON_URL = "data/countries-lite.geojson";

let missionIndex = 0;
let selectedBiomeId = "amazonia";
let selectedHabitat = null;
let exploredHabitats = new Set();
let adaptationSolved = false;
let selectedCountryId = "brazil";
let selectedLandmarkIndex = 0;
let globeApi = null;
let globePaused = false;
let globeFlagsVisible = false;
let xrSession = null;
let countrySearchTerm = "";
let worldCountries = [];
let countryGeoJson = null;
let worldDataPromise = null;

function show(element) {
  element.classList.remove("is-hidden");
}

function hide(element) {
  element.classList.add("is-hidden");
}

function setActionVisibility({ tryAgain = false, next = false }) {
  tryAgainButton.classList.toggle("is-visible", tryAgain);
  nextButton.classList.toggle("is-visible", next);
}

function openHub() {
  show(gameHub);
  hide(worldGame);
  biomeScreens.forEach(hide);
  window.scrollTo(0, 0);
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function openBiomes() {
  hide(gameHub);
  hide(worldGame);
  hide(mission);
  hide(completeCard);
  show(heroCard);
  window.scrollTo(0, 0);
}

function openWorld() {
  hide(gameHub);
  biomeScreens.forEach(hide);
  show(worldGame);
  hide(countryPanel);
  hide(countryBrowser);
  window.scrollTo(0, 0);
  initWorldGame();
  requestAnimationFrame(() => globeApi?.resize());
}

function currentMission() {
  return missions[missionIndex];
}

function getMapHabitats() {
  return Object.entries(habitats).filter(([, habitat]) => habitat.map);
}

function currentSpecies() {
  return species[currentMission().species];
}

function getTrait(traitId) {
  return traits[traitId] || ["✨", traitId.replaceAll("_", " ")];
}

function getHabitatTraitIds(habitatId) {
  const habitat = habitats[habitatId];
  return [...habitat.traits, ...(habitat.aliases || [])];
}

function getMatchingTraitIds(speciesId, habitatId) {
  const animal = species[speciesId];
  const habitatTraitIds = new Set(getHabitatTraitIds(habitatId));
  return animal.needs.filter((traitId) => habitatTraitIds.has(traitId));
}

function getMissingTraitIds(speciesId, habitatId) {
  const animal = species[speciesId];
  const matchingTraitIds = new Set(getMatchingTraitIds(speciesId, habitatId));
  return animal.needs.filter((traitId) => !matchingTraitIds.has(traitId));
}

function getCompatibilityLevel(speciesId, habitatId) {
  const animal = species[speciesId];
  const matchingTraitCount = getMatchingTraitIds(speciesId, habitatId).length;
  const isPreferredHabitat = animal.preferredHabitats?.includes(habitatId);

  if (isPreferredHabitat && matchingTraitCount > 0) {
    return "good";
  }

  if (matchingTraitCount > 0) {
    return "ok";
  }

  return "low";
}

function formatTraitNames(traitIds) {
  return traitIds.map((traitId) => getTrait(traitId)[1]).join(", ");
}

function renderBiomeMap() {
  biomeRegions.innerHTML = getMapHabitats()
    .map(([habitatId, habitat]) => {
      const geometry = BIOME_GEOMETRY[habitatId];

      return `
        <path
          class="biome-region ${selectedBiomeId === habitatId ? "is-selected" : ""}"
          data-biome="${habitatId}"
          tabindex="0"
          role="button"
          aria-label="${habitat.map.label}"
          aria-pressed="${selectedBiomeId === habitatId}"
          style="--region-color: ${habitat.map.color};"
          d="${geometry.path}"
        />
      `;
    })
    .join("");

  biomeMapLabels.innerHTML = getMapHabitats()
    .map(([habitatId, habitat]) => {
      const geometry = BIOME_GEOMETRY[habitatId];
      const { label } = habitat.map;
      const labelPosition = geometry.labelPosition;

      return `
        <text
          class="biome-label"
          x="${labelPosition.x}"
          y="${labelPosition.y}"
        >
          ${label}
        </text>
      `;
    })
    .join("");
}

function renderBiomeFacts(facts) {
  return facts.map((fact) => `<span class="clue"><span>✨</span>${fact}</span>`).join("");
}

function selectBiome(habitatId) {
  const habitat = habitats[habitatId];
  selectedBiomeId = habitatId;

  biomeInfo.style.setProperty("--selected-biome-color", habitat.map.color);
  biomeInfoTitle.textContent = habitat.map.label;
  biomeInfoImage.src = habitat.image;
  biomeInfoImage.alt = habitat.name;
  biomeInfoShort.textContent = habitat.map.short;
  biomeInfoFacts.innerHTML = renderBiomeFacts(habitat.map.facts);
  biomeInfoStory.textContent = habitat.map.story;
  renderBiomeMap();
}

function buildFeedbackText(speciesId, habitatId, level) {
  const animal = species[speciesId];
  const matchingTraitIds = getMatchingTraitIds(speciesId, habitatId);
  const missingTraitIds = getMissingTraitIds(speciesId, habitatId);

  if (level === "good") {
    return `Aqui tem ${formatTraitNames(matchingTraitIds)}. ${animal.adaptation.explanation}`;
  }

  if (level === "ok") {
    return `Aqui tem ${formatTraitNames(matchingTraitIds)}, mas ainda falta ${formatTraitNames(missingTraitIds)}.`;
  }

  return `Falta ${formatTraitNames(missingTraitIds)}. Vamos procurar outro lugar?`;
}

function createMission(missionData) {
  return {
    species: missionData.species,
    story: missionData.story || species[missionData.species].story,
    adaptationQuestion: species[missionData.species].adaptation.question,
    adaptationAnswer: species[missionData.species].adaptation.answer,
    adaptationOptions: species[missionData.species].adaptation.options,
    options: missionData.habitats.map((habitatId) => {
      const level = getCompatibilityLevel(missionData.species, habitatId);

      return {
        habitat: habitatId,
        level,
        why: buildFeedbackText(missionData.species, habitatId, level),
      };
    }),
  };
}

function findOption(habitatId) {
  return currentMission().options.find((option) => option.habitat === habitatId);
}

function renderTraitChips(traitIds) {
  return traitIds
    .map((traitId) => {
      const [icon, text] = getTrait(traitId);
      return `<span class="clue"><span>${icon}</span>${text}</span>`;
    })
    .join("");
}

function renderHiddenClues(habitatId) {
  if (!exploredHabitats.has(habitatId)) {
    return `
      <span class="clue clue-hidden">❔ pista escondida</span>
      <span class="clue clue-hidden">❔ pista escondida</span>
    `;
  }

  return renderTraitChips(habitats[habitatId].traits);
}

function renderMission() {
  const missionData = currentMission();
  const animal = currentSpecies();
  selectedHabitat = null;
  exploredHabitats = new Set();
  adaptationSolved = false;

  roundLabel.textContent = `Animal perdido ${missionIndex + 1} de ${missions.length}`;
  missionTitle.textContent = `Ajude o ${animal.name}`;
  narration.textContent = missionData.story;
  environmentArt.className = "animal-card";
  environmentArt.setAttribute("aria-label", animal.name);
  environmentArt.innerHTML = `
    <img src="${animal.image}" alt="${animal.name}" />
    <div class="animal-card-copy">
      <p class="eyebrow">Ele procura</p>
      <div class="clues">${renderTraitChips(animal.needs)}</div>
    </div>
  `;
  clues.innerHTML = `
    <span class="guide-chip">1. Explore os lugares</span>
    <span class="guide-chip">2. Veja as pistas</span>
    <span class="guide-chip">3. Leve para o melhor lar</span>
  `;

  renderHabitatChoices();
  hide(feedback);
  hide(adaptationCard);
  setActionVisibility({});
}

function renderHabitatChoices() {
  const missionData = currentMission();
  choiceGrid.innerHTML = missionData.options
    .map(({ habitat }) => {
      const place = habitats[habitat];
      const explored = exploredHabitats.has(habitat);
      const pressed = selectedHabitat === habitat;

      return `
        <article class="habitat-card ${explored ? "is-explored" : ""}" data-habitat="${habitat}" aria-label="${place.name}">
          <button class="habitat-image-button" type="button" data-action="explore" data-habitat="${habitat}" aria-pressed="${pressed}">
            <img src="${place.image}" alt="${place.name}" />
            <span class="scan-badge">${explored ? "🔎 investigado" : "✨ investigar"}</span>
          </button>
          <div class="habitat-copy">
            <h3>${place.name}</h3>
            <div class="clues habitat-clues">${renderHiddenClues(habitat)}</div>
            <button class="primary-button choose-home-button" type="button" data-action="choose" data-habitat="${habitat}">
              Levar para cá
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function exploreHabitat(habitatId) {
  selectedHabitat = habitatId;
  exploredHabitats.add(habitatId);
  hide(feedback);
  hide(adaptationCard);
  setActionVisibility({});
  renderHabitatChoices();
}

function chooseHabitat(habitatId) {
  if (!exploredHabitats.has(habitatId)) {
    exploreHabitat(habitatId);
    return;
  }

  selectedHabitat = habitatId;
  const option = findOption(habitatId);
  const feedbackContent = feedbackByLevel[option.level];
  const animal = currentSpecies();

  document.querySelectorAll(".habitat-image-button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.habitat === habitatId));
  });

  feedback.className = `feedback ${option.level}`;
  feedbackBadge.textContent = feedbackContent.badge;
  feedbackTitle.textContent = feedbackContent.title;
  feedbackText.textContent =
    option.level === "good"
      ? `${feedbackContent.text} ${animal.name} fica bem aqui. ${option.why}`
      : `${feedbackContent.text} ${option.why}`;

  show(feedback);
  hide(adaptationCard);
  setActionVisibility({ tryAgain: option.level !== "good", next: false });

  if (option.level === "good") {
    renderAdaptation();
  }
}

function renderAdaptation() {
  const missionData = currentMission();
  adaptationQuestion.textContent = missionData.adaptationQuestion;
  adaptationOptions.innerHTML = missionData.adaptationOptions
    .map(
      (option) => `
        <button class="adaptation-option" type="button" data-adaptation="${option}" aria-pressed="false">
          ${option}
        </button>
      `,
    )
    .join("");
  show(adaptationCard);
  setActionVisibility({});
}

function chooseAdaptation(option) {
  const missionData = currentMission();
  const isRight = option === missionData.adaptationAnswer;
  adaptationSolved = isRight;

  document.querySelectorAll(".adaptation-option").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.adaptation === option));
  });

  feedback.className = isRight ? "feedback good" : "feedback ok";
  feedbackBadge.textContent = isRight ? "🎉" : "🔎";
  feedbackTitle.textContent = isRight ? "Descoberta guardada!" : "Investigue mais um pouquinho.";
  feedbackText.textContent = isRight
    ? `Isso! ${option} combina com as pistas deste lugar.`
    : "Olhe para o corpo do ser vivo e para o lugar que combinou melhor.";
  show(feedback);
  setActionVisibility({ tryAgain: !isRight, next: isRight });
}

function nextMission() {
  if (missionIndex < missions.length - 1) {
    missionIndex += 1;
    renderMission();
    return;
  }

  hide(mission);
  show(completeCard);
}

function restartGame() {
  missionIndex = 0;
  hide(gameHub);
  hide(worldGame);
  hide(completeCard);
  hide(heroCard);
  show(mission);
  window.scrollTo(0, 0);
  renderMission();
}

function speakCurrentPrompt() {
  if (!("speechSynthesis" in window)) {
    return;
  }

  const animal = currentSpecies();
  const utterance = new SpeechSynthesisUtterance(
    `Ajude o ${animal.name}. ${currentMission().story} Explore os lugares e veja as pistas.`,
  );
  utterance.lang = "pt-BR";
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPopulation(value) {
  if (!value) {
    return "-";
  }

  if (value >= 1_000_000) {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value / 1_000_000)} milhões`;
  }

  return formatNumber(value);
}

function formatArea(value) {
  if (!value) {
    return null;
  }

  return `${formatNumber(Math.round(value))} km²`;
}

function listObjectValues(object, formatter = (value) => value) {
  return Object.values(object || {})
    .map(formatter)
    .filter(Boolean);
}

function colorFromId(id) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 360;
  }
  return `hsl(${hash}, 62%, 46%)`;
}

function slugCountryName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getPopulationForCountry(country, populationByName) {
  const names = [
    country.name?.common,
    country.name?.official,
    country.translations?.por?.common,
    ...(country.altSpellings || []),
  ].filter(Boolean);
  const match = names.find((name) => populationByName.has(name.toLowerCase()));
  return country.population || (match ? populationByName.get(match.toLowerCase()) : null);
}

function normalizeRestCountry(country, populationByName = new Map()) {
  const commonName =
    country.translations?.por?.common ||
    country.name?.native?.por?.common ||
    country.name?.common ||
    country.name?.official ||
    "Pais sem nome";
  const officialName =
    country.translations?.por?.official ||
    country.name?.native?.por?.official ||
    country.name?.official ||
    commonName;
  const capital = country.capital?.[0] || "Capital nao informada";
  const latlng = country.latlng?.length === 2 ? country.latlng : [0, 0];
  const population = getPopulationForCountry(country, populationByName);
  const id = (country.cca3 || country.cca2 || slugCountryName(commonName)).toLowerCase();
  const languages = listObjectValues(country.languages).slice(0, 4);
  const currencies = listObjectValues(country.currencies, (currency) => currency.name).slice(0, 3);
  const facts = [
    country.area ? `Area: ${formatArea(country.area)}` : null,
    languages.length ? `Idiomas: ${languages.join(", ")}` : null,
    currencies.length ? `Moedas: ${currencies.join(", ")}` : null,
  ].filter(Boolean);
  const manualContent = COUNTRY_CONTENT[id];
  const kidSummary =
    manualContent?.summary ||
    `Este país fica em ${country.region || "uma parte do mundo"}. A capital é ${capital}. Ele tem lugares, comidas, músicas e histórias que podemos descobrir com calma.`;
  const kidMusic =
    manualContent?.music ||
    (languages.length
      ? `Neste país, muitas pessoas falam ${languages.slice(0, 2).join(" e ")}. Vamos procurar músicas cantadas nesses idiomas.`
      : "Vamos procurar músicas, danças e sons tradicionais deste país.");
  const defaultLandmark = {
    name: `${capital} - capital`,
    kind: "capital",
    lat: country.capitalInfo?.latlng?.[0],
    lon: country.capitalInfo?.latlng?.[1],
    query: `${capital}, ${commonName}`,
  };
  const manualLandmarks = manualContent?.landmarks?.map((landmark) => ({
    kind: "ponto de interesse",
    query: `${landmark.name}, ${commonName}`,
    ...landmark,
  }));
  const exportCatalog = typeof COUNTRY_EXPORTS !== "undefined" ? COUNTRY_EXPORTS : {};
  const manualExports = manualContent?.exports || exportCatalog[id] || [];

  return {
    id,
    iso2: country.cca2,
    iso3: country.cca3,
    name: commonName,
    officialName,
    searchNames: [
      commonName,
      officialName,
      country.name?.common,
      country.name?.official,
      ...(country.altSpellings || []),
    ].filter(Boolean),
    flag: country.flag || "🌎",
    coords: { lat: latlng[0], lon: latlng[1] },
    region: [country.region, country.subregion].filter(Boolean).join(" - ") || "Planeta Terra",
    population: formatPopulation(population),
    capital,
    facts,
    exports: manualExports,
    history: kidSummary,
    music: kidMusic,
    color: colorFromId(id),
    mapsUrl: country.maps?.googleMaps,
    landmarks: manualLandmarks?.length ? manualLandmarks : [defaultLandmark],
  };
}

function normalizeFallbackCountry(country) {
  return {
    ...country,
    iso3: country.iso3 || country.id.toUpperCase().slice(0, 3),
    population: country.population,
    facts: country.exports || [],
    officialName: country.name,
    searchNames: [country.name, country.capital, country.id],
    mapsUrl: null,
  };
}

function getCountries() {
  return worldCountries.length ? worldCountries : WORLD_DATA.countries.map(normalizeFallbackCountry);
}

function getSelectedCountry() {
  return getCountries().find((country) => country.id === selectedCountryId) || getCountries()[0];
}

function findInitialCountryId(countries) {
  return countries.find((country) => country.iso3 === "BRA")?.id || countries[0]?.id || "brazil";
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${url}`);
  }
  return response.json();
}

async function loadWorldData() {
  if (worldDataPromise) {
    return worldDataPromise;
  }

  sourceStatus.textContent = "Carregando dados reais...";
  worldDataPromise = Promise.all([
    fetchJson(COUNTRY_DATA_URL),
    fetchJson(COUNTRY_POPULATION_URL),
    fetchJson(COUNTRY_GEOJSON_URL),
  ])
    .then(([countryData, populationData, geoJson]) => {
      const populationByName = new Map(
        populationData.map((item) => [String(item.country).toLowerCase(), item.population]),
      );
      worldCountries = countryData
        .map((country) => normalizeRestCountry(country, populationByName))
        .filter((country) => country.iso3 && Number.isFinite(country.coords.lat) && Number.isFinite(country.coords.lon))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      countryGeoJson = geoJson;
      selectedCountryId = findInitialCountryId(worldCountries);
      sourceStatus.textContent = `${worldCountries.length} paises - dados locais + GeoJSON real`;
    })
    .catch((error) => {
      console.warn(error);
      worldCountries = WORLD_DATA.countries.map(normalizeFallbackCountry);
      selectedCountryId = findInitialCountryId(worldCountries);
      sourceStatus.textContent = "Usando fallback local; dados externos indisponiveis";
    });

  return worldDataPromise;
}

function getVisibleCountries() {
  const term = countrySearchTerm.trim().toLowerCase();
  if (!term) {
    return getCountries();
  }

  return getCountries().filter((country) => {
    return [country.name, country.officialName, country.capital, country.iso2, country.iso3, ...(country.searchNames || [])]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(term));
  });
}

function hasStreetViewCoordinates(landmark) {
  return Number.isFinite(landmark.lat) && Number.isFinite(landmark.lon);
}

function getLandmarkQuery(landmark) {
  if (hasStreetViewCoordinates(landmark)) {
    return `${landmark.lat},${landmark.lon}`;
  }

  return landmark.query || landmark.name;
}

function makeMapEmbedUrl(landmark) {
  return `https://www.google.com/maps?q=${encodeURIComponent(getLandmarkQuery(landmark))}&output=embed`;
}

function makeMapsUrl(landmark) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getLandmarkQuery(landmark))}`;
}

function makeStreetViewUrlForNewTab(landmark) {
  if (!hasStreetViewCoordinates(landmark)) {
    return makeMapsUrl(landmark);
  }

  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(`${landmark.lat},${landmark.lon}`)}`;
}

function renderCountryStrip() {
  const countries = getVisibleCountries();
  countryStrip.innerHTML = countries
    .map(
      (country) => `
        <button class="country-button" type="button" data-country="${country.id}" aria-pressed="${country.id === selectedCountryId}">
          <span>${country.flag}</span>
          <span>${country.name}</span>
        </button>
      `,
    )
    .join("");

  if (!countries.length) {
    countryStrip.innerHTML = `<p class="source-status">Nenhum pais encontrado.</p>`;
  }
}

function renderCountryPanel() {
  const country = getSelectedCountry();
  const landmark = country.landmarks[selectedLandmarkIndex] || country.landmarks[0];

  countryFlag.textContent = country.flag;
  countryRegion.textContent = country.region;
  countryName.textContent = country.name;
  countryPopulation.textContent = country.population;
  countryCapital.textContent = country.capital;
  countryExports.innerHTML = (country.exports?.length ? country.exports : ["Exportações principais ainda não cadastradas"])
    .map((item) => `<span class="export-chip">${item}</span>`)
    .join("");
  countryHistory.textContent = country.history;
  countryMusic.textContent = country.music;
  landmarkList.innerHTML = country.landmarks
    .map(
      (item, index) => `
        <button class="landmark-button" type="button" data-landmark="${index}" aria-pressed="${index === selectedLandmarkIndex}">
          ${item.name}
        </button>
      `,
    )
    .join("");
  streetViewFrame.src = makeMapEmbedUrl(landmark);
  streetViewFrame.title = `Exploracao de ${landmark.name} no Google Maps`;
  mapsLink.href = makeMapsUrl(landmark);
  streetViewLink.href = makeStreetViewUrlForNewTab(landmark);
  streetViewLink.classList.toggle("is-disabled", !hasStreetViewCoordinates(landmark));
  streetViewLink.textContent = hasStreetViewCoordinates(landmark)
    ? "Abrir Street View"
    : "Buscar no Maps";
  document.documentElement.style.setProperty("--selected-country-color", country.color);
}

function selectCountry(countryId, { openDetails = true, focusGlobe = false } = {}) {
  selectedCountryId = countryId;
  selectedLandmarkIndex = 0;
  renderCountryStrip();
  renderCountryPanel();
  if (openDetails) {
    show(countryPanel);
    hide(countryBrowser);
  }
  globeApi?.focusCountry(countryId, { rotate: focusGlobe });
}

function selectLandmark(index) {
  selectedLandmarkIndex = index;
  renderCountryPanel();
}

function speakCountryMusic() {
  if (!("speechSynthesis" in window)) {
    return;
  }

  const country = getSelectedCountry();
  const utterance = new SpeechSynthesisUtterance(`${country.name}. ${country.music}`);
  utterance.lang = "pt-BR";
  utterance.rate = 0.88;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function createMarkerTexture(country) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  context.fillStyle = country.color;
  context.beginPath();
  context.arc(128, 128, 96, 0, Math.PI * 2);
  context.fill();
  context.lineWidth = 12;
  context.strokeStyle = "#ffffff";
  context.stroke();
  context.font = "96px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(country.flag, 128, 132);
  return new THREE.CanvasTexture(canvas);
}

function mapPoint(lon, lat, width, height) {
  return {
    x: ((lon + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  };
}

function getFeatureIso3(feature) {
  return (
    feature.properties?.ISO_A3 ||
    feature.properties?.iso_a3 ||
    feature.properties?.ADM0_A3 ||
    feature.properties?.SOV_A3 ||
    feature.properties?.ISO3166_1_ALPHA_3 ||
    feature.properties?.["ISO3166-1-Alpha-3"] ||
    ""
  ).toLowerCase();
}

function drawGeoJsonRing(context, ring, width, height) {
  if (!ring?.length) {
    return;
  }

  let previousLon = null;
  ring.forEach(([lon, lat], index) => {
    const point = mapPoint(lon, lat, width, height);
    const crossesDateLine = previousLon !== null && Math.abs(lon - previousLon) > 180;
    if (index === 0 || crossesDateLine) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
    previousLon = lon;
  });
}

function drawGeoJsonFeature(context, feature, width, height, options = {}) {
  const { geometry } = feature;
  if (!geometry) {
    return;
  }

  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  context.beginPath();
  polygons.forEach((polygon) => {
    polygon.forEach((ring) => drawGeoJsonRing(context, ring, width, height));
  });
  context.fillStyle = options.fill || "#62bd70";
  context.fill("evenodd");
  context.lineWidth = options.lineWidth || 2;
  context.strokeStyle = options.stroke || "rgba(255, 255, 255, 0.34)";
  context.stroke();
}

function unwrapLongitude(lon, referenceLon) {
  let adjusted = lon;
  while (adjusted - referenceLon > 180) {
    adjusted -= 360;
  }
  while (adjusted - referenceLon < -180) {
    adjusted += 360;
  }
  return adjusted;
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const currentLon = unwrapLongitude(ring[index][0], lon);
    const currentLat = ring[index][1];
    const previousLon = unwrapLongitude(ring[previous][0], lon);
    const previousLat = ring[previous][1];
    const crossesLatitude = currentLat > lat !== previousLat > lat;
    if (!crossesLatitude) {
      continue;
    }
    const intersectLon =
      ((previousLon - currentLon) * (lat - currentLat)) / (previousLat - currentLat) + currentLon;
    if (lon < intersectLon) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(lon, lat, polygon) {
  if (!pointInRing(lon, lat, polygon[0])) {
    return false;
  }

  return !polygon.slice(1).some((hole) => pointInRing(lon, lat, hole));
}

function featureContainsLonLat(feature, lon, lat) {
  const { geometry } = feature;
  if (!geometry) {
    return false;
  }

  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((polygon) => pointInPolygon(lon, lat, polygon));
}

function findCountryIdAtLonLat(lon, lat) {
  const feature = countryGeoJson?.features?.find((item) => featureContainsLonLat(item, lon, lat));
  const iso3 = feature ? getFeatureIso3(feature) : "";
  return getCountries().find((country) => country.iso3?.toLowerCase() === iso3)?.id || null;
}

function vectorToLatLon(vector) {
  const radius = vector.length();
  const lat = Math.asin(vector.y / radius) * (180 / Math.PI);
  const theta = Math.atan2(vector.z, -vector.x);
  let lon = theta * (180 / Math.PI) - 180;
  while (lon < -180) {
    lon += 360;
  }
  while (lon > 180) {
    lon -= 360;
  }
  return { lat, lon };
}

function createEarthMapTexture(selectedCountryIdForTexture = selectedCountryId) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  const ocean = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  ocean.addColorStop(0, "#1d74a8");
  ocean.addColorStop(0.55, "#2aa8b8");
  ocean.addColorStop(1, "#165f9c");
  context.fillStyle = ocean;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (countryGeoJson?.features?.length) {
    const selectedCountry = getCountries().find((country) => country.id === selectedCountryIdForTexture);
    const selectedIso3 = selectedCountry?.iso3?.toLowerCase();
    countryGeoJson.features.forEach((feature) => {
      const iso3 = getFeatureIso3(feature);
      const isSelected = iso3 && selectedIso3 && iso3 === selectedIso3;
      drawGeoJsonFeature(context, feature, canvas.width, canvas.height, {
        fill: isSelected ? "#ffd66b" : "#63c984",
        stroke: isSelected ? "rgba(36, 65, 60, 0.72)" : "rgba(255, 255, 255, 0.36)",
        lineWidth: isSelected ? 5 : 1.6,
      });
    });
  } else {
    context.fillStyle = "#63c984";
    context.fillRect(canvas.width * 0.18, canvas.height * 0.24, canvas.width * 0.64, canvas.height * 0.48);
  }

  context.strokeStyle = "rgba(255, 255, 255, 0.18)";
  context.lineWidth = 2;
  for (let lon = -180; lon <= 180; lon += 30) {
    const start = mapPoint(lon, -80, canvas.width, canvas.height);
    const end = mapPoint(lon, 80, canvas.width, canvas.height);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const start = mapPoint(-180, lat, canvas.width, canvas.height);
    const end = mapPoint(180, lat, canvas.width, canvas.height);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

function createCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255, 255, 255, 0.34)";
  context.lineWidth = 12;
  context.lineCap = "round";
  for (let i = 0; i < 46; i += 1) {
    const y = 50 + Math.random() * 410;
    const x = Math.random() * canvas.width;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x + 70, y - 35, x + 150, y + 40, x + 245, y - 8);
    context.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

function initGlobe() {
  if (globeApi || !globeCanvas || typeof THREE === "undefined") {
    return globeApi;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#102742");

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 1.2, 6.2);

  const renderer = new THREE.WebGLRenderer({
    canvas: globeCanvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 8;
  controls.rotateSpeed = 0.45;

  const globeRoot = new THREE.Group();
  scene.add(globeRoot);

  const earthGroup = new THREE.Group();
  globeRoot.add(earthGroup);

  const earthTexture = createEarthMapTexture();
  earthTexture.anisotropy = 8;
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(2, 96, 96),
    new THREE.MeshPhongMaterial({
      map: earthTexture,
      emissive: new THREE.Color("#143335"),
      emissiveIntensity: 0.12,
      shininess: 3,
      specular: new THREE.Color("#0b2430"),
    }),
  );
  earthGroup.add(earth);

  const cloudsTexture = createCloudTexture();
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(2.035, 96, 96),
    new THREE.MeshLambertMaterial({
      map: cloudsTexture,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  earthGroup.add(clouds);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(2.08, 96, 96),
    new THREE.MeshBasicMaterial({
      color: "#7dd9ff",
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    }),
  );
  globeRoot.add(atmosphere);

  const markerGroup = new THREE.Group();
  markerGroup.visible = globeFlagsVisible;
  earthGroup.add(markerGroup);
  const markers = new Map();
  getCountries().forEach((country) => {
    const marker = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createMarkerTexture(country),
        transparent: true,
        depthTest: true,
      }),
    );
    marker.position.copy(latLonToVector3(country.coords.lat, country.coords.lon, 2.14));
    marker.scale.set(0.12, 0.12, 0.12);
    marker.userData.countryId = country.id;
    markerGroup.add(marker);
    markers.set(country.id, marker);
  });

  const ambientLight = new THREE.AmbientLight("#9fc7d8", 0.58);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight("#fff2be", 1.65);
  scene.add(sunLight);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 32, 32),
    new THREE.MeshBasicMaterial({ color: "#ffd66b" }),
  );
  scene.add(sun);

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = [];
  for (let i = 0; i < 520; i += 1) {
    const radius = 18 + Math.random() * 18;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPositions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
    );
  }
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  scene.add(
    new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: "#ffffff", size: 0.035, transparent: true, opacity: 0.72 }),
    ),
  );

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const controllerRaycaster = new THREE.Raycaster();
  const tempMatrix = new THREE.Matrix4();
  let globePointerStart = null;
  let elapsed = 0;

  function fillRoundRect(context, x, y, width, height, radius) {
    context.beginPath();
    if (context.roundRect) {
      context.roundRect(x, y, width, height, radius);
    } else {
      context.rect(x, y, width, height);
    }
    context.fill();
  }

  function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";

    words.forEach((word) => {
      const testLine = line ? `${line} ${word}` : word;
      if (context.measureText(testLine).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    });

    if (line) {
      lines.push(line);
    }

    lines.slice(0, maxLines).forEach((item, index) => {
      const suffix = index === maxLines - 1 && lines.length > maxLines ? "..." : "";
      context.fillText(`${item}${suffix}`, x, y + index * lineHeight);
    });

    return y + Math.min(lines.length, maxLines) * lineHeight;
  }

  function drawInfoPill(context, text, x, y, width, color) {
    context.fillStyle = color;
    fillRoundRect(context, x, y, width, 54, 26);
    context.fillStyle = "#24413c";
    context.font = "800 30px Trebuchet MS, Arial, sans-serif";
    context.fillText(text, x + 24, y + 13, width - 48);
  }

  function createVrInfoTexture(country) {
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 1800;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    const panel = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    panel.addColorStop(0, "rgba(255, 255, 255, 0.98)");
    panel.addColorStop(1, "rgba(226, 248, 242, 0.96)");
    context.fillStyle = panel;
    fillRoundRect(context, 46, 44, 1308, 1712, 72);

    context.fillStyle = country.color;
    fillRoundRect(context, 94, 92, 1212, 210, 52);
    context.fillStyle = "rgba(255, 255, 255, 0.22)";
    fillRoundRect(context, 94, 92, 310, 210, 52);

    context.fillStyle = "#ffffff";
    context.font = "900 134px Arial, sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(country.flag, 142, 200);
    context.font = "900 76px Trebuchet MS, Arial, sans-serif";
    context.fillText(country.name, 430, 177, 800);
    context.font = "800 36px Trebuchet MS, Arial, sans-serif";
    context.fillText(country.region, 434, 244, 790);

    context.fillStyle = "#24413c";
    context.textBaseline = "top";
    context.font = "900 42px Trebuchet MS, Arial, sans-serif";
    context.fillText("Capital", 110, 356);
    context.fillText("Populacao", 738, 356);
    context.font = "900 58px Trebuchet MS, Arial, sans-serif";
    context.fillText(country.capital, 110, 406, 520);
    context.fillText(country.population, 738, 406, 460);

    let y = 530;
    context.fillStyle = "#2c7a57";
    context.font = "900 42px Trebuchet MS, Arial, sans-serif";
    context.fillText("Principais exportacoes", 110, y);
    context.fillStyle = "#24413c";
    (country.exports?.length ? country.exports : ["Exportacoes ainda nao cadastradas"]).slice(0, 5).forEach((item, index) => {
      const row = Math.floor(index / 2);
      const column = index % 2;
      drawInfoPill(context, item, 110 + column * 590, y + 64 + row * 70, 550, index % 2 === 0 ? "#eef6f5" : "#fff5c5");
    });
    y += 278;

    context.fillStyle = "#2c7a57";
    context.font = "900 42px Trebuchet MS, Arial, sans-serif";
    context.fillText("Historia rapida", 110, y);
    context.fillStyle = "#24413c";
    context.font = "800 34px Trebuchet MS, Arial, sans-serif";
    y = drawWrappedText(context, country.history, 110, y + 58, 1180, 44, 4) + 28;

    context.fillStyle = "#2c7a57";
    context.font = "900 42px Trebuchet MS, Arial, sans-serif";
    context.fillText("Musica e cultura", 110, y);
    context.fillStyle = "#24413c";
    context.font = "800 34px Trebuchet MS, Arial, sans-serif";
    y = drawWrappedText(context, country.music, 110, y + 58, 1180, 44, 3) + 26;

    context.fillStyle = "#2c7a57";
    context.font = "900 42px Trebuchet MS, Arial, sans-serif";
    context.fillText("Pontos para visitar", 110, y);
    context.fillStyle = "#24413c";
    context.font = "800 34px Trebuchet MS, Arial, sans-serif";
    country.landmarks.slice(0, 3).forEach((landmark, index) => {
      context.fillText(`${index + 1}. ${landmark.name}`, 130, y + 58 + index * 46, 1120);
    });
    y += 218;

    context.fillStyle = "#2c7a57";
    context.font = "900 42px Trebuchet MS, Arial, sans-serif";
    context.fillText("Dados reais", 110, y);
    context.fillStyle = "#24413c";
    context.font = "800 30px Trebuchet MS, Arial, sans-serif";
    (country.facts || []).slice(0, 3).forEach((fact, index) => {
      context.fillText(`• ${fact}`, 130, y + 56 + index * 40, 1120);
    });

    context.fillStyle = "rgba(36, 65, 60, 0.72)";
    context.font = "900 30px Trebuchet MS, Arial, sans-serif";
    context.fillText("Aperte para escolher. Segure e mova o controle para girar o globo.", 110, 1672, 1180);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    return texture;
  }

  function createTextSprite(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(255, 255, 255, 0.92)";
    fillRoundRect(context, 32, 42, 960, 172, 42);
    context.fillStyle = "#24413c";
    context.font = "900 82px Trebuchet MS, Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 512, 132, 900);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      }),
    );
    sprite.scale.set(1.7, 0.42, 1);
    return sprite;
  }

  const vrLabel = createTextSprite(getSelectedCountry().name);
  vrLabel.position.set(0, 2.55, 0);
  vrLabel.visible = false;
  globeRoot.add(vrLabel);

  const vrInfoPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.82, 2.34),
    new THREE.MeshBasicMaterial({
      map: createVrInfoTexture(getSelectedCountry()),
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  );
  vrInfoPanel.position.set(3.05, 0.48, 0.15);
  vrInfoPanel.rotation.y = -0.28;
  vrInfoPanel.visible = false;
  globeRoot.add(vrInfoPanel);

  function updateVrLabel(country) {
    const nextLabel = createTextSprite(country.name);
    vrLabel.material.map?.dispose();
    vrLabel.material.map = nextLabel.material.map;
    vrLabel.material.needsUpdate = true;
    nextLabel.material.dispose();
  }

  function updateVrInfoPanel(country) {
    const nextTexture = createVrInfoTexture(country);
    vrInfoPanel.material.map?.dispose();
    vrInfoPanel.material.map = nextTexture;
    vrInfoPanel.material.needsUpdate = true;
  }

  function setControllerRay(controller) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    controllerRaycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    controllerRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  }

  function findCountryFromEarthHit(hit) {
    const localPoint = earth.worldToLocal(hit.point.clone());
    const { lon, lat } = vectorToLatLon(localPoint);
    return findCountryIdAtLonLat(lon, lat);
  }

  function getControllerTarget(controller) {
    setControllerRay(controller);
    const markerHit = markerGroup.visible ? controllerRaycaster.intersectObjects([...markers.values()])[0] : null;
    if (markerHit?.object?.userData?.countryId) {
      return { countryId: markerHit.object.userData.countryId, earthHit: null };
    }

    const earthHit = controllerRaycaster.intersectObject(earth)[0];
    return {
      countryId: earthHit ? findCountryFromEarthHit(earthHit) : null,
      earthHit,
    };
  }

  function controllerDirection(controller) {
    setControllerRay(controller);
    return controllerRaycaster.ray.direction.clone().normalize();
  }

  function normalizeAngleDelta(delta) {
    let adjusted = delta;
    while (adjusted > Math.PI) {
      adjusted -= Math.PI * 2;
    }
    while (adjusted < -Math.PI) {
      adjusted += Math.PI * 2;
    }
    return adjusted;
  }

  function startControllerInteraction(controller) {
    const target = getControllerTarget(controller);
    controller.userData.isDraggingGlobe = Boolean(target.countryId || target.earthHit);
    controller.userData.dragMoved = false;
    controller.userData.dragDistance = 0;
    controller.userData.pendingCountryId = target.countryId;
    controller.userData.lastDirection = controllerDirection(controller);
  }

  function updateControllerDrag(controller) {
    if (!controller.userData.isDraggingGlobe) {
      return;
    }

    const nextDirection = controllerDirection(controller);
    const lastDirection = controller.userData.lastDirection || nextDirection;
    const deltaYaw = normalizeAngleDelta(
      Math.atan2(nextDirection.x, -nextDirection.z) - Math.atan2(lastDirection.x, -lastDirection.z),
    );
    const deltaPitch = Math.asin(nextDirection.y) - Math.asin(lastDirection.y);
    const movement = Math.abs(deltaYaw) + Math.abs(deltaPitch);

    if (movement > 0.0005) {
      rotateBy(deltaPitch * 1.8, deltaYaw * 1.8);
      controller.userData.dragDistance = (controller.userData.dragDistance || 0) + movement;
      controller.userData.dragMoved = controller.userData.dragDistance > 0.035;
    }

    controller.userData.lastDirection = nextDirection;
  }

  function finishControllerInteraction(controller) {
    if (!controller.userData.isDraggingGlobe) {
      return;
    }

    const target = getControllerTarget(controller);
    const countryId = target.countryId || controller.userData.pendingCountryId;
    const shouldSelect = countryId && !controller.userData.dragMoved;
    controller.userData.isDraggingGlobe = false;
    controller.userData.pendingCountryId = null;

    if (shouldSelect) {
      selectCountry(countryId, { openDetails: false, focusGlobe: false });
    }
  }

  function buildController(index) {
    const controller = renderer.xr.getController(index);
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: index === 0 ? 0xffd66b : 0x7dd9ff,
        transparent: true,
        opacity: 0.72,
      }),
    );
    line.name = "ray";
    line.scale.z = 4;
    controller.add(line);
    scene.add(controller);
    controller.addEventListener("selectstart", () => startControllerInteraction(controller));
    controller.addEventListener("selectend", () => finishControllerInteraction(controller));
    return controller;
  }
  const controllers = [buildController(0), buildController(1)];

  function resize() {
    const { width, height } = globeStage.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function focusCountry(countryId, { rotate = true } = {}) {
    const country = getCountries().find((item) => item.id === countryId);
    if (country) {
      if (rotate) {
        const target = latLonToVector3(country.coords.lat, country.coords.lon, 2);
        const yRotation = Math.atan2(-target.x, target.z);
        const zPrime = Math.sqrt(target.x * target.x + target.z * target.z);
        const xRotation = Math.atan2(target.y, zPrime);
        earthGroup.rotation.x = xRotation;
        earthGroup.rotation.y = yRotation;
      }

      const nextTexture = createEarthMapTexture(countryId);
      nextTexture.anisotropy = 8;
      earth.material.map?.dispose();
      earth.material.map = nextTexture;
      earth.material.needsUpdate = true;
      updateVrLabel(country);
      updateVrInfoPanel(country);
    }

    markers.forEach((marker, id) => {
      const isSelected = id === countryId;
      marker.scale.setScalar(isSelected ? 0.46 : 0.1);
      marker.material.opacity = isSelected ? 1 : 0.52;
    });
  }

  function rotateBy(deltaX, deltaY) {
    earthGroup.rotation.x = Math.max(-1.25, Math.min(1.25, earthGroup.rotation.x + deltaX));
    earthGroup.rotation.y += deltaY;
  }

  function zoomBy(delta) {
    camera.position.z = Math.max(4, Math.min(8, camera.position.z + delta));
    controls.update();
  }

  function resetView() {
    camera.position.set(0, 1.2, 6.2);
    focusCountry(selectedCountryId);
    controls.update();
  }

  function pickCountry(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const markerHit = markerGroup.visible ? raycaster.intersectObjects([...markers.values()])[0] : null;
    if (markerHit?.object?.userData?.countryId) {
      selectCountry(markerHit.object.userData.countryId);
      return;
    }

    const earthHit = raycaster.intersectObject(earth)[0];
    if (!earthHit) {
      return;
    }

    const localPoint = earth.worldToLocal(earthHit.point.clone());
    const { lon, lat } = vectorToLatLon(localPoint);
    const countryId = findCountryIdAtLonLat(lon, lat);
    if (countryId) {
      selectCountry(countryId, { focusGlobe: false });
    }
  }

  function startGlobePointer(event) {
    if (renderer.xr.isPresenting) {
      return;
    }

    globePointerStart = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function finishGlobePointer(event) {
    if (!globePointerStart || globePointerStart.id !== event.pointerId || renderer.xr.isPresenting) {
      globePointerStart = null;
      return;
    }

    const deltaX = event.clientX - globePointerStart.x;
    const deltaY = event.clientY - globePointerStart.y;
    globePointerStart = null;

    if (Math.hypot(deltaX, deltaY) > 12) {
      return;
    }

    pickCountry(event);
  }

  function cancelGlobePointer() {
    globePointerStart = null;
  }

  function setFlagsVisible(visible) {
    markerGroup.visible = visible;
  }

  function setVrPresentation(active) {
    if (active) {
      globeRoot.position.set(0, 1.35, -3.1);
      globeRoot.scale.setScalar(0.72);
      vrLabel.visible = true;
      vrInfoPanel.visible = true;
      controls.enabled = false;
      return;
    }

    globeRoot.position.set(0, 0, 0);
    globeRoot.scale.setScalar(1);
    vrLabel.visible = false;
    vrInfoPanel.visible = false;
    controls.enabled = true;
    camera.position.set(0, 1.2, 6.2);
    controls.update();
  }

  function render(time = 0) {
    const delta = Math.min(0.032, (time - elapsed) / 1000 || 0.016);
    elapsed = time;

    if (!globePaused) {
      earthGroup.rotation.y += delta * 0.025;
      clouds.rotation.y += delta * 0.045;
    }

    const sunAngle = time * 0.00008 + Math.PI / 2;
    const sunPosition = new THREE.Vector3(Math.cos(sunAngle) * 6, 1.8, Math.sin(sunAngle) * 6);
    sun.position.set(sunPosition.x * 0.78 + 2.2, 3.25, sunPosition.z * 0.78);
    sunLight.position.copy(sunPosition);

    const phase = ((sunAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const labels = ["amanhecer", "dia", "entardecer", "noite"];
    dayNightLabel.textContent = `Ciclo: ${labels[Math.floor((phase / (Math.PI * 2)) * labels.length)]}`;

    controllers.forEach(updateControllerDrag);

    if (!renderer.xr.isPresenting) {
      controls.update();
    }
    renderer.render(scene, camera);
  }

  renderer.domElement.addEventListener("pointerdown", startGlobePointer);
  renderer.domElement.addEventListener("pointerup", finishGlobePointer);
  renderer.domElement.addEventListener("pointercancel", cancelGlobePointer);
  renderer.domElement.addEventListener("pointerleave", cancelGlobePointer);
  window.addEventListener("resize", resize);
  resize();
  focusCountry(selectedCountryId);
  renderer.setAnimationLoop(render);

  globeApi = { resize, focusCountry, rotateBy, zoomBy, resetView, setFlagsVisible, setVrPresentation, renderer };
  return globeApi;
}

async function initWorldGame() {
  await loadWorldData();
  renderCountryStrip();
  renderCountryPanel();
  initGlobe();
  globeApi?.focusCountry(selectedCountryId);
  updateVrButtonAvailability();
}

async function updateVrButtonAvailability() {
  if (!("xr" in navigator)) {
    vrButton.disabled = true;
    vrButton.textContent = "VR";
    vrButton.title = "WebXR não está disponível neste navegador.";
    return;
  }

  try {
    const supported = await navigator.xr.isSessionSupported("immersive-vr");
    vrButton.disabled = !supported;
    vrButton.title = supported
      ? "Entrar em realidade virtual"
      : "Este dispositivo não anunciou suporte a VR.";
  } catch (error) {
    vrButton.disabled = true;
    vrButton.title = "Não foi possível verificar o suporte a VR.";
  }
}

async function startVrSession() {
  if (!globeApi?.renderer || vrButton.disabled) {
    return;
  }

  if (xrSession) {
    await xrSession.end();
    return;
  }

  try {
    const session = await navigator.xr.requestSession("immersive-vr", {
      optionalFeatures: ["local-floor", "bounded-floor"],
    });
    xrSession = session;
    vrButton.classList.add("is-active");
    vrButton.textContent = "Sair";
    globeApi.setVrPresentation(true);
    session.addEventListener("end", () => {
      xrSession = null;
      vrButton.classList.remove("is-active");
      vrButton.textContent = "VR";
      globeApi?.setVrPresentation(false);
    });
    await globeApi.renderer.xr.setSession(session);
  } catch (error) {
    console.warn(error);
    vrButton.classList.remove("is-active");
    vrButton.textContent = "VR";
    globeApi?.setVrPresentation(false);
  }
}

startButton.addEventListener("click", restartGame);
restartButton.addEventListener("click", restartGame);
voiceButton.addEventListener("click", speakCurrentPrompt);
gameOpenButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.openGame === "world") {
      openWorld();
      return;
    }

    openBiomes();
  });
});
backHubButtons.forEach((button) => button.addEventListener("click", openHub));
biomeMap.addEventListener("click", (event) => {
  const region = event.target.closest("[data-biome]");
  if (!region) {
    return;
  }

  selectBiome(region.dataset.biome);
});
biomeMap.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const region = event.target.closest("[data-biome]");
  if (!region) {
    return;
  }

  event.preventDefault();
  selectBiome(region.dataset.biome);
});
tryAgainButton.addEventListener("click", () => {
  hide(feedback);
  setActionVisibility({});

  if (selectedHabitat && findOption(selectedHabitat)?.level === "good") {
    adaptationSolved = false;
    document.querySelectorAll(".adaptation-option").forEach((button) => {
      button.setAttribute("aria-pressed", "false");
    });
    return;
  }

  selectedHabitat = null;
  hide(adaptationCard);
  document.querySelectorAll(".habitat-image-button").forEach((button) => {
    button.setAttribute("aria-pressed", "false");
  });
});
nextButton.addEventListener("click", nextMission);
vrButton.addEventListener("click", startVrSession);
pauseGlobeButton.addEventListener("click", () => {
  globePaused = !globePaused;
  pauseGlobeButton.textContent = globePaused ? "▶" : "⏸";
  pauseGlobeButton.setAttribute("aria-label", globePaused ? "Retomar globo" : "Pausar globo");
});
toggleFlagsButton.addEventListener("click", () => {
  globeFlagsVisible = !globeFlagsVisible;
  globeApi?.setFlagsVisible(globeFlagsVisible);
  toggleFlagsButton.classList.toggle("is-active", globeFlagsVisible);
  toggleFlagsButton.setAttribute("aria-label", globeFlagsVisible ? "Ocultar bandeiras" : "Mostrar bandeiras");
});
toggleCountryBrowser.addEventListener("click", () => {
  countryBrowser.classList.toggle("is-hidden");
});
closeCountryBrowser.addEventListener("click", () => {
  hide(countryBrowser);
});
closeCountryPanel.addEventListener("click", () => {
  hide(countryPanel);
});
globeControlButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const control = button.dataset.globeControl;
    if (control === "up") {
      globeApi?.rotateBy(-0.18, 0);
    } else if (control === "down") {
      globeApi?.rotateBy(0.18, 0);
    } else if (control === "left") {
      globeApi?.rotateBy(0, -0.22);
    } else if (control === "right") {
      globeApi?.rotateBy(0, 0.22);
    } else if (control === "zoom-in") {
      globeApi?.zoomBy(-0.45);
    } else if (control === "zoom-out") {
      globeApi?.zoomBy(0.45);
    } else if (control === "reset") {
      globeApi?.resetView();
    }
  });
});
countryStrip.addEventListener("click", (event) => {
  const button = event.target.closest("[data-country]");
  if (!button) {
    return;
  }

  selectCountry(button.dataset.country, { focusGlobe: true });
});
countrySearch.addEventListener("input", () => {
  countrySearchTerm = countrySearch.value;
  renderCountryStrip();
});
landmarkList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-landmark]");
  if (!button) {
    return;
  }

  selectLandmark(Number(button.dataset.landmark));
});
musicButton.addEventListener("click", speakCountryMusic);

choiceGrid.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  const { action, habitat } = actionButton.dataset;
  if (action === "explore") {
    exploreHabitat(habitat);
  }

  if (action === "choose") {
    chooseHabitat(habitat);
  }
});

adaptationOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-adaptation]");
  if (!button || adaptationSolved) {
    return;
  }
  chooseAdaptation(button.dataset.adaptation);
});

selectBiome(selectedBiomeId);
