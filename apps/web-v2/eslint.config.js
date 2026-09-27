/**
 * QUOI     — les règles de lint de la V2.
 * POURQUOI — ce que la V1 a laissé passer par bonne volonté (any, console.log, fichiers de
 *            1 000 lignes, composants qui appellent Supabase), l'outil le refuse ici.
 */
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const V1 = { group: ['**/explore-web/**'], message: 'La V2 n’importe jamais la V1.' }
const OTHER_ZONE_BY_PATH = {
  group: ['../../*'],
  message: 'Remonter de deux dossiers = changer de zone. Passer par @/shared.',
}
const OTHER_ZONE = {
  group: ['@/features/*'],
  message: 'Une zone n’importe pas une autre zone. Monter le code dans @/shared.',
}

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'src/shared/supabase/database.types.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      'no-console': 'error',
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'no-restricted-imports': ['error', { patterns: [V1, OTHER_ZONE_BY_PATH] }],
    },
  },
  {
    // Une zone n'importe jamais une autre zone, ni la coquille.
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            V1,
            OTHER_ZONE_BY_PATH,
            OTHER_ZONE,
            { group: ['@/app/*'], message: 'Une zone ne dépend pas de la coquille.' },
          ],
        },
      ],
    },
  },
  {
    // Un composant ne parle jamais à Supabase : il passe par un hook, qui passe par api/.
    files: ['src/**/components/**/*.{ts,tsx}', 'src/app/shell/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@supabase/supabase-js', message: 'Un composant ne parle pas à Supabase.' },
          ],
          patterns: [
            V1,
            OTHER_ZONE_BY_PATH,
            {
              group: ['@/shared/supabase/*'],
              message: 'Un composant ne parle pas à Supabase : hook → api/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.{js,ts}', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
    extends: [tseslint.configs.disableTypeChecked],
  },
)
