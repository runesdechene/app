/**
 * QUOI     — point d'entrée de la V2 : tient l'app à jour, monte le cache de données (et ce qu'il
 *            garde sur l'appareil) et le routeur dans #root.
 */
import './shared/styles/tokens.css'
import './shared/styles/global.css'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { persistance, queryClient } from './app/queryClient'
import { router } from './app/router'
import { tenirAJour } from './app/miseAJour'

tenirAJour()

const root = document.getElementById('root')
if (!root) throw new Error('#root absent de index.html')

createRoot(root).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistance}>
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  </StrictMode>,
)
