/**
 * QUOI     — point d'entrée de la V2 : monte l'application dans #root.
 * POURQUOI — provisoire : la Task 6 remplace AppPlaceholder par le routeur.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

export function AppPlaceholder() {
  return <p>Runes de Chêne V2</p>
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <AppPlaceholder />
    </StrictMode>,
  )
}
