/**
 * QUOI     — configuration de Vite (serveur de dev, build) et de Vitest (tests) du Hub V2.
 * POURQUOI — même pile que la V2 (spec Hub V2 §4) ; `envDir` lit le .env racine commun.
 */
/// <reference types="vitest/config" />
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  envDir: path.resolve(import.meta.dirname, '../..'),
  plugins: [react()],
  // @send-push : le code de send-push (Deno), source de ce qui part en notification, lu tel quel.
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src'), '@send-push': path.resolve(import.meta.dirname, '../../supabase/functions/send-push') } },
  server: { port: 5175 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    env: { VITE_SUPABASE_URL: 'http://localhost', VITE_SUPABASE_ANON_KEY: 'test' },
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
