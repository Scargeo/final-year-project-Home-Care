import js from '@eslint/js'
import nextVitals from 'eslint-config-next/core-web-vitals'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.next']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      ...nextVitals,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      "@next/next/no-img-element": "off",
    },
  },
  {
    // Server files run in Node/CommonJS, so they need Node globals and source type.
    files: ['server/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
  {
    // Root signaling server uses ESM imports and runs under the project-level module type.
    files: ['index.js'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.node,
    },
  },
])
