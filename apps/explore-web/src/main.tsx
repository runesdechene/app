import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
// Récupération auto des échecs de chargement de chunk (écran blanc post-deploy).
// Import a effet de bord — doit etre charge avant tout import dynamique.
import './lib/chunkReload'
// Capture `beforeinstallprompt` au plus tot (l'event est tire une seule fois,
// avant le montage des routes). Import a effet de bord — doit rester ici.
import './lib/pwaInstall'
import { RootErrorBoundary } from './components/RootErrorBoundary'
import { doitAllerSurV2 } from './lib/v2Access'

// Le joueur a choisi la nouvelle Explore : on l'y envoie avant d'afficher la V1.
if (doitAllerSurV2(document.cookie, window.location)) {
  window.location.replace('/v2/')
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </React.StrictMode>,
  )
}
