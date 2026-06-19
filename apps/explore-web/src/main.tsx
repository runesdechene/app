import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
// Capture `beforeinstallprompt` au plus tot (l'event est tire une seule fois,
// avant le montage des routes). Import a effet de bord — doit rester ici.
import './lib/pwaInstall'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
