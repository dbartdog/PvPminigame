import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/build/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    // Hard rule 2: the sim must replay identically on client and server.
    files: ['packages/sim/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded RNG in the game state: packages/sim must be deterministic.',
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'Date',
          message: 'Use the tick number: packages/sim must not read the wall clock.',
        },
        {
          name: 'performance',
          message: 'Use the tick number: packages/sim must not read the wall clock.',
        },
      ],
    },
  },
  prettier,
);
