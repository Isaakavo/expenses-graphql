import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'src/generated', '**/*.{js,cjs,mjs}'] },
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      quotes: ['error', 'single'],
      indent: ['error', 2],
      'no-console': ['error'],
    },
  },
);
