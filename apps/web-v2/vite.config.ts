/**
 * QUOI     — configuration de Vite (serveur de dev, build, PWA) et de Vitest (tests).
 * POURQUOI — depuis la bascule (spec 2026-10-07-v2-bascule), Explore est servi à la racine
 *            d'app.runesdechene.com ; `envDir` lit le même .env racine que le Hub.
 * ATTENTION — PWA : service worker maison (src/sw.ts), portée / — servi à /sw.js, il remplace
 *            celui de la V1 sur les téléphones et garde ses abonnements push. Il ne sert que les
 *            écrans d'Explore (liste blanche, src/sw/ecrans.ts).
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
  base: '/',
  define: { __VERSION__: JSON.stringify(version) },
  envDir: path.resolve(import.meta.dirname, '../..'),
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // L'enregistrement se fait dans src/app/miseAJour.ts (vérifications régulières).
      injectRegister: false,
      scope: '/',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Runes de Chêne',
        short_name: 'Runes de Chêne',
        lang: 'fr',
        id: '/',
        start_url: '/accueil',
        scope: '/',
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
        globIgnores: ['res/**', 'email-*', 'pwa-*.png', 'v2/**'],
      },
    }),
  ],
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
