/**
 * QUOI     — configuration de Vite (serveur de dev, build) et de Vitest (tests).
 * POURQUOI — la V2 est servie sous /v2/ : `base` fait pointer tous les fichiers générés
 *            vers /v2/…, et `envDir` lit le même .env racine que la V1 et le Hub.
 * ATTENTION — en dev, le proxy sert la V1 sur le même port : lancer `pnpm dev` (V1) ET
 *            `pnpm dev:v2`, puis tout ouvrir sur http://localhost:5174.
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
  server: {
    port: 5174,
    // En local comme en prod, V1 et V2 partagent une origine : tout ce qui n'est pas /v2 part
    // vers le serveur de dev de la V1 (`pnpm dev`, port 3000). Même origine = même session.
    proxy: {
      '^/(?!v2(/|$)).*': { target: 'http://localhost:3000', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Les tests ne dépendent jamais des vraies clés.
    env: { VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_ANON_KEY: 'test' },
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
