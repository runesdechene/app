import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MapPage from './pages/MapPage'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import ActivityPage from './pages/ActivityPage'
import LandingPage from './components/landing/LandingPage'
import RequireAuth from './components/RequireAuth'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/carte" element={<MapPage />} />
          <Route path="/accueil" element={<HomePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/activite" element={<ActivityPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
