/**
 * QUOI     — point d'entrée de la V2 : monte le cache de données et le routeur dans #root.
 */
import './shared/styles/tokens.css'
import './shared/styles/global.css'
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
