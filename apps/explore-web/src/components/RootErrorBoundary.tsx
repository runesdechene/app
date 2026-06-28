// Error Boundary racine — filet de sécurité contre l'écran blanc.
//
// Avant : aucune Error Boundary dans l'app. Une exception au render (souvent un
// import dynamique de route rejeté après un déploiement) démontait tout l'arbre
// React → page blanche permanente jusqu'à relance manuelle.
//
// Maintenant :
//  - erreur de chunk (build périmé) → reload auto une fois (cohérent avec le
//    handler vite:preloadError), écran neutre pendant la bascule ;
//  - toute autre erreur → écran d'erreur propre avec bouton « Recharger ».

import { Component, type ReactNode } from 'react'
import { AppLoader } from './AppLoader'
import { isChunkLoadError, reloadOnceForChunkError } from '../lib/chunkReload'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    if (isChunkLoadError(error)) {
      // Build périmé : on tente de récupérer automatiquement. Si la garde
      // anti-boucle bloque le reload, on reste sur le fallback ci-dessous.
      reloadOnceForChunkError()
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (isChunkLoadError(error)) {
      // Pendant que le reload se déclenche (ou si la garde l'a bloqué).
      return <AppLoader label="Mise à jour…" />
    }

    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.2rem',
          padding: '2rem',
          textAlign: 'center',
          background: '#f8f3e7',
          color: '#5a4632',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: '2rem' }} aria-hidden>
          🌳
        </div>
        <h1 style={{ fontSize: '1.2rem', margin: 0 }}>Une erreur est survenue</h1>
        <p style={{ margin: 0, maxWidth: 320, fontSize: '0.95rem', opacity: 0.85 }}>
          Recharge la page pour reprendre ton aventure.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '0.4rem',
            padding: '0.7rem 1.6rem',
            border: 'none',
            borderRadius: 999,
            background: '#5a4632',
            color: '#f8f3e7',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Recharger
        </button>
      </div>
    )
  }
}
