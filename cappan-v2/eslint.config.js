/* ESLint flat config — nghiêm nhất hợp lý: no-unused-vars, eqeqeq, prefer-const.
   Chỉ mục tiêu bắt bug thật, không xoáy style (style để Prettier). */
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }], // rest-omit pattern ({ passwordHash, ...pub }) là dùng hợp lệ
      eqeqeq: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'off'
    }
  },
  {
    // tests dùng console + node:test
    files: ['tests/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } }
  }
];
