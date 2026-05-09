import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MapPage from './pages/MapPage'
import HomePage from './pages/HomePage'
import LandingPage from './components/landing/LandingPage'
import RequireAuth from './components/RequireAuth'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/accueil" element={<HomePage />} />
          <Route path="/carte" element={<MapPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
