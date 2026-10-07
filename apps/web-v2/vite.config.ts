/**
 * QUOI     — configuration de Vite (serveur de dev, build, PWA) et de Vitest (tests).
 * POURQUOI — la V2 est servie sous /v2/ : `base` fait pointer tous les fichiers générés
 *            vers /v2/…, et `envDir` lit le même .env racine que la V1 et le Hub.
 * ATTENTION — en dev, le proxy sert la V1 sur le même port : lancer `pnpm dev` (V1) ET
 *            `pnpm dev:v2`, puis tout ouvrir sur http://localhost:5174.
 *            PWA : service worker maison (src/sw.ts), portée /v2/ — il ne touche jamais la V1,
 *            et celui de la V1 ignore /v2 (apps/explore-web/src/sw.ts).
 */
/// <reference types="vitest/config" />
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// La version affichée en bas de la barre (shared/lib/version.ts) : celle de package.json.
const { version } = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf-8'),
) as {
  version: string
}

const FOND = '#fcf3e4' // --color-fond (tokens.css) — le manifeste ne lit pas les variables CSS.

export default defineConfig({
  base: '/v2/',
  define: { __VERSION__: JSON.stringify(version) },
  envDir: path.resolve(import.meta.dirname, '../..'),
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // L'enregistrement se fait dans src/app/miseAJour.ts (vérifications régulières).
      injectRegister: false,
      scope: '/v2/',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Runes de Chêne',
        short_name: 'Runes de Chêne',
        lang: 'fr',
        start_url: '/v2/accueil',
        scope: '/v2/',
        display: 'standalone',
        background_color: FOND,
        theme_color: FOND,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // Service worker maison (src/sw.ts) : précache, liste blanche, push. skipWaiting et
      // clientsClaim y sont écrits (piège du 02/10 : sans eux, une version reste en attente).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Ce que le domaine sert encore pour d'autres que l'appli (e-mails, tutoriel du Hub,
        // icônes des V1 installées) : servi, pas mis en cache sur chaque téléphone.
        globIgnores: ['res/**', 'email-*', 'pwa-*.png'],
      },
    }),
  ],
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
