import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(path.join(directory, entry.name))
      : entry.name.endsWith('.ts')
        ? [path.join(directory, entry.name)]
        : [],
  );
}
describe('simulation dependency boundaries', () => {
  for (const file of [...sources('packages/domain/src'), ...sources('packages/simulation/src')]) {
    it(`${file} has no UI, narrative or wall-clock dependency`, () => {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/\b(?:Math\.random|Date\.now|performance\.now|randomUUID)\s*\(/);
      expect(source).not.toMatch(
        /from\s+['"][^'"]*(?:react|electron|pixi|zustand|narrative|application|desktop)[^'"]*['"]/,
      );
    });
  }
});
