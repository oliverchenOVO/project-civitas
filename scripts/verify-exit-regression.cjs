/* eslint-disable @typescript-eslint/no-require-imports -- diagnostic CommonJS tool */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const builder = path.dirname(require.resolve('electron-builder/package.json'));
const library = path.dirname(require.resolve('app-builder-lib/package.json', { paths: [builder] }));
const asar = require(require.resolve('@electron/asar', { paths: [library] }));
const appVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const archive = `release/${appVersion}/win-unpacked/resources/app.asar`;
const entries = asar
  .listPackage(archive)
  .map((name) => name.replace(/\\/g, '/').replace(/^\//, ''))
  .filter(
    (name) =>
      name.startsWith('dist/') ||
      name === 'apps/desktop/electron/main.cjs' ||
      name === 'apps/desktop/electron/preload.cjs',
  );
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const files = [];
for (const name of entries) {
  const archiveName = path.normalize(name);
  if (asar.statFile(archive, archiveName).files) continue;
  const packedHash = hash(asar.extractFile(archive, archiveName));
  files.push({
    name,
    packedHash,
    sourceHash: hash(fs.readFileSync(name)),
    matches: packedHash === hash(fs.readFileSync(name)),
  });
}
const read = (name) => JSON.parse(fs.readFileSync(name, 'utf8'));
const baseline = (name) =>
  JSON.parse(
    execFileSync('git', ['show', `v0.1.0-rc.1:artifacts/${name}.json`], { encoding: 'utf8' }),
  );
const before = baseline('benchmark');
const after = read('artifacts/benchmark.json');
const oldSeeds = baseline('stability');
const newSeeds = read('artifacts/stability.json');
const result = {
  appVersion,
  productionPayloadMatchesFreshBuild:
    files.length > 0 &&
    files.every((file) => file.matches) &&
    files.some((file) => file.name === 'apps/desktop/electron/main.cjs'),
  files,
  benchmarkHashesUnchanged:
    before.length === 4 &&
    after.length === before.length &&
    before.every((row, index) => row.finalHash === after[index].finalHash),
  stabilityHashesUnchanged:
    oldSeeds.length === 100 &&
    newSeeds.length === oldSeeds.length &&
    oldSeeds.every((row, index) => row.hash === newSeeds[index].hash),
  benchmark: after,
  seedCount: newSeeds.length,
};
fs.writeFileSync('artifacts/qa/exit-regression.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, files: files.length, benchmark: undefined }));
if (
  !result.productionPayloadMatchesFreshBuild ||
  !result.benchmarkHashesUnchanged ||
  !result.stabilityHashesUnchanged
)
  process.exit(1);
