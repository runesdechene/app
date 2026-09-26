import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const ENV_DIR = path.resolve(__dirname, '../..')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ENV_DIR, 'VITE_')
  // Netlify passe ses variables par process.env, pas par un fichier .env.
  const isDemo = (env.VITE_DEMO_MODE ?? process.env.VITE_DEMO_MODE) === 'true'

  return {
  envDir: ENV_DIR,
  plugins: [
    react(),
    VitePWA({
      // Borne (VITE_DEMO_MODE) : AUCUN service worker. Le 6 août 2026, une
      // migration RGPD a retiré `users.email_address` au rôle authenticated ;
      // le front corrigé le jour même n'a jamais atteint la borne, restée trois
      // semaines sur son bundle précaché (énergie 0/3, découverte impossible).
      // Un SW n'apporte rien à une borne branchée qui recharge toutes les 3 min,
      // et `registerType: 'prompt'` ne peut pas se mettre à jour sans quelqu'un
      // pour cliquer. Elle doit exécuter ce qui est déployé, point.
      disable: isDemo,
      // 'prompt' (et pas 'autoUpdate') : un nouveau SW ne prend PLUS le contrôle
      // en pleine session. Couplé à la suppression de skipWaiting dans sw.ts, ça
      // évite que cleanupOutdatedCaches efface les chunks de l'ancien build
      // pendant qu'une page vivante les charge encore (cause de l'écran blanc).
      // La mise à jour délibérée passe par UpdateBanner (KILL_SWITCH + reload).
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Runes de Chêne',
        short_name: 'Runes de Chêne',
        description: "App d'Aventure locale. 2 600+ lieux d'Histoire et de Nature à redécouvrir avec la Confrérie.",
        theme_color: '#f8f3e7',
        background_color: '#f8f3e7',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'fr',
        start_url: '/post-login',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}']
      }
    })
  ],
  clearScreen: false,
  server: {
    port: 3000,
    strictPort: true,
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
  build: {
    target: 'es2022',
  }
  }
})
