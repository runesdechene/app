/**
 * QUOI     — point d'entrée du Hub V2 : la DA partagée, le cache de données, le routeur.
 */
import '@runes/da/polices'
import '@runes/da/tokens.css'
import '@runes/da/global.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { queryClient } from './app/queryClient'
import { router } from './app/router'

const root = document.getElementById('root')
if (!root) throw new Error('#root absent de index.html')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
