import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    name: 'generated-output-and-local-state',
    ignores: [
      '**/node_modules/**',
      '**/.env',
      '**/.env.*',
      '.worktrees/**',
      '.cache/**',
      'coverage/**',
      'distribution/claude-code/**',
      'dist/**',
      'build/**',
      'plugins/**/dist/**',
      'plugins/**/build/**',
      'mcp-servers/**/dist/**',
      'mcp-servers/**/build/**',
      'packages/**/dist/**',
      'packages/**/build/**',
    ],
  },
  {
    name: 'maintained-javascript',
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.nodeBuiltin,
    },
    rules: {
      ...js.configs.recommended.rules,
      eqeqeq: ['error', 'always'],
      'max-depth': ['error', 4],
      'max-nested-callbacks': ['error', 4],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    name: 'commonjs-runtime',
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
];
