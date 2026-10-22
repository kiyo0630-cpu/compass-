// ルートの ESLint 設定（flat config）。
// 対象: attack-map のスクリプト・Worker と tests/。e-card-src は oxlint（e-card-src/.oxlintrc.json）で別途 Lint する。
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'e-card/**',           // Vite のビルド成果物
      'e-card-src/**',       // oxlint が担当
      'attack-map/data/**',
      '**/*.html',
    ],
  },
  js.configs.recommended,
  {
    files: ['attack-map/scripts/**/*.{js,mjs}', 'tests/**/*.{js,mjs}'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
  },
  {
    files: ['attack-map/worker/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.serviceworker, ...globals.browser } },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': 'error',
      'eqeqeq': ['error', 'smart'],
    },
  },
];
