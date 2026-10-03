import tseslint from 'typescript-eslint';
export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'release/**',
      '.desktop-runtime/**',
      'artifacts/qa/**',
      'apps/desktop/electron/**',
    ],
  },
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
