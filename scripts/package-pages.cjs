const fs = require('node:fs');
const path = require('node:path');

// Explicit entry points prevent documentation, generators and source corpora from
// becoming public simply because they were committed beside the static website.
const runtimeFiles = [
  '.nojekyll', 'CNAME', 'index.html', 'styles.css', 'app.js',
  'game-data.js', 'world-data.js', 'country-content.js', 'biome-geometry.js',
  'data/world-countries.json', 'data/country-by-population.json',
  'data/countries-lite.geojson',
  'numberblocks-1-100/blocos-de-somar.html', 'numberblocks-1-100/game-voice.js',
  'numberblocks-somar/index.html', 'numberblocks-somar/numberblocks.js',
  'numberblocks-somar/numberblocks.css',
  'fono-do-leo/index.html', 'fono-do-leo/sw.js',
  'assets/narration-player.js',
  'assets/narration/manifest.json', 'assets/narration/manifest.js',
  ...Array.from({ length: 100 }, (_, index) =>
    `numberblocks-1-100/${String(index + 1).padStart(3, '0')}.webp`),
];

function listRuntimeFiles(sourceDirectory) {
  const files = [...runtimeFiles];
  for (const [directory, allowed] of [
    ['assets', /\.(?:png|jpe?g|webp|svg|gif|ico)$/i],
    ['assets/narration', /^[a-zA-Z0-9_-]+\.mp3$/],
  ]) {
    for (const entry of fs.readdirSync(path.join(sourceDirectory, directory), { withFileTypes: true })) {
      if (entry.isFile() && allowed.test(entry.name)) files.push(`${directory}/${entry.name}`);
    }
  }
  for (const file of files) {
    if (!fs.lstatSync(path.join(sourceDirectory, file)).isFile()) {
      throw new Error(`Runtime asset must be a regular file: ${file}`);
    }
  }
  return [...new Set(files)].sort();
}

function packagePages(sourceDirectory, outputDirectory) {
  const source = path.resolve(sourceDirectory);
  const output = path.resolve(outputDirectory);
  if (output === source || source.startsWith(output + path.sep)) {
    throw new Error('The output directory must not contain the source directory.');
  }
  // Never delete a caller-supplied directory. A fresh artifact also makes stale
  // files from a previous deployment impossible to publish accidentally.
  if (fs.existsSync(output) && fs.readdirSync(output).length) {
    throw new Error('The output directory must be empty or absent.');
  }
  const files = listRuntimeFiles(source);
  for (const file of files) {
    const destination = path.join(output, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(source, file), destination);
  }
  return files;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const output = path.resolve(root, process.argv[2] || '_site');
  const files = packagePages(root, output);
  console.log(`Packaged ${files.length} runtime files into ${output}`);
}

module.exports = { runtimeFiles, listRuntimeFiles, packagePages };
