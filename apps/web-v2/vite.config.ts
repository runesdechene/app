/**
 * QUOI     — configuration de Vite (serveur de dev, build) et de Vitest (tests).
 * POURQUOI — la V2 est servie sous /v2/ : `base` fait pointer tous les fichiers générés
 *            vers /v2/…, et `envDir` lit le même .env racine que la V1 et le Hub.
 */
/// <reference types="vitest/config" />
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/v2/',
  envDir: path.resolve(import.meta.dirname, '../..'),
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: { port: 5174 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Les tests ne dépendent jamais des vraies clés.
    env: { VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_ANON_KEY: 'test' },
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
