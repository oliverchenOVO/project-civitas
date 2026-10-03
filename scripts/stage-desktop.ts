import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const metadata = JSON.parse(readFileSync('package.json', 'utf8'));
const runtime = '.desktop-runtime';
mkdirSync(runtime, { recursive: true });
cpSync('dist', `${runtime}/dist`, { recursive: true });
cpSync('apps/desktop/electron', `${runtime}/apps/desktop/electron`, { recursive: true });
writeFileSync(
  `${runtime}/package.json`,
  JSON.stringify(
    {
      name: metadata.name,
      version: metadata.version,
      description: metadata.description,
      author: metadata.author,
      main: metadata.main,
    },
    null,
    2,
  ),
);
console.log(
  'Staged bundled renderer and isolated Electron entrypoints; no development dependencies.',
);
