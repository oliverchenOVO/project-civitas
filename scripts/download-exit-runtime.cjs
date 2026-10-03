/* eslint-disable @typescript-eslint/no-require-imports -- diagnostic CommonJS tool */
const path = require('node:path');
const fs = require('node:fs');
const from = path.dirname(require.resolve('electron/package.json'));
const { downloadArtifact } = require(require.resolve('@electron/get', { paths: [from] }));
const extract = require(require.resolve('extract-zip', { paths: [from] }));
(async () => {
  const version = process.argv[2];
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected exact Electron version');
  const directory = path.resolve('artifacts/qa/runtimes', version);
  fs.mkdirSync(directory, { recursive: true });
  const archive = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: 'win32',
    arch: 'x64',
  });
  await extract(archive, { dir: directory });
  console.log(`Isolated runtime ${version}: artifacts/qa/runtimes/${version}/electron.exe`);
})();
