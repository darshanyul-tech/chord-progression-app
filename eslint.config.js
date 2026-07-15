import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'legacy', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Tier-1 firewall (D15 / 01-architecture.md §1): src/lib must stay framework-free.
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/lib is Tier-1 (framework-free) — no React imports.' },
            { name: 'react-dom', message: 'src/lib is Tier-1 (framework-free) — no React imports.' },
            { name: 'react-router-dom', message: 'src/lib is Tier-1 (framework-free) — no router imports.' },
            { name: 'zustand', message: 'src/lib is Tier-1 (framework-free) — no Zustand imports.' },
          ],
          patterns: [
            {
              group: ['**/state/*', '**/state', '**/shell/*', '**/components/*', '**/topics/*', '**/exam/*'],
              message: 'src/lib must not import from outside src/lib (Tier-1 firewall).',
            },
          ],
        },
      ],
    },
  },
);
