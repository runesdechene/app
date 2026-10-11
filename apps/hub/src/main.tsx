import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/bebas-neue/400.css'
import '@fontsource/cabin/400.css'
import '@fontsource/cabin/400-italic.css'
import '@fontsource/cabin/500.css'
import '@fontsource/cabin/600.css'
import '@fontsource/cabin/700.css'
import '@fontsource/cabin-condensed/400.css'
import '@fontsource/cabin-condensed/500.css'
import '@fontsource/cabin-condensed/600.css'
import '@fontsource/cabin-condensed/700.css'
import '@fontsource/alegreya/500.css'
import '@fontsource/alegreya/600.css'
import '@fontsource/alegreya/700.css'
import '@fontsource/alegreya/800.css'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
