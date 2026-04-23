import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MapPage from './pages/MapPage'

function LandingPlaceholder() {
  return (
    <div style={{ padding: '4rem', textAlign: 'center', minHeight: '100vh' }}>
      <h1>Landing Page (placeholder)</h1>
      <p><a href="/carte">Aller à la carte →</a></p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPlaceholder />} />
        <Route path="/carte" element={<MapPage />} />
      </Routes>
    </BrowserRouter>
  )
}
