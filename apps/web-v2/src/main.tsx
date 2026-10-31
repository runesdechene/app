/**
 * QUOI     — point d'entrée de la V2 : tient l'app à jour (et dit quand une version arrive),
 *            monte le cache de données (et ce qu'il garde sur l'appareil) et le routeur dans #root.
 *            Les polices et les jetons viennent de @runes/da (packages/da), partagés avec le Hub.
 */
import '@runes/da/polices'
import '@runes/da/tokens.css'
import '@runes/da/global.css'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { persistance, queryClient } from './app/queryClient'
import { router } from './app/router'
import { tenirAJour } from './app/miseAJour'
import { NouvelleVersion } from './app/NouvelleVersion'
import { ecouterInstallation } from './app/installation'

tenirAJour()
ecouterInstallation() // avant le rendu : Chrome ne propose l'installation qu'une fois

const root = document.getElementById('root')
if (!root) throw new Error('#root absent de index.html')

createRoot(root).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistance}>
      <RouterProvider router={router} />
      <NouvelleVersion />
    </PersistQueryClientProvider>
  </StrictMode>,
)
