import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomeRoute from './pages/HomeRoute'
import MapRouteGuard from './pages/MapRouteGuard'
import LandingPage from './components/landing/LandingPage'
import RequireAuth from './components/RequireAuth'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/accueil" element={<HomeRoute />} />
          <Route path="/carte" element={<MapRouteGuard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
