import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import MapPage from './pages/MapPage'
import LandingPage from './components/landing/LandingPage'
import RequireAuth from './components/RequireAuth'
import { InstallPrompt } from './components/pwa/InstallPrompt'
import { useIsDesktop } from './hooks/useMediaQuery'

const MobileLayout = lazy(() => import('./pages/MobileLayout'))
const HomePage = lazy(() => import('./pages/HomePage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const ActivityPage = lazy(() => import('./pages/ActivityPage'))
const NouvellesPage = lazy(() => import('./pages/NouvellesPage'))
const ArticlePage = lazy(() => import('./pages/ArticlePage'))
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'))

/** Redirige vers /accueil sur mobile et /carte sur desktop. Utilisé pour /post-login. */
function RootRedirect() {
  const isDesktop = useIsDesktop()
  return <Navigate to={isDesktop ? '/carte' : '/accueil'} replace />
}

/** Sur desktop, les routes mobile-only redirigent vers /carte. */
function MobileOnly({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop()
  if (isDesktop) return <Navigate to="/carte" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/post-login" element={<RootRedirect />} />
            <Route path="/carte" element={<MapPage />} />
            <Route element={<MobileOnly><MobileLayout /></MobileOnly>}>
              <Route path="/accueil" element={<HomePage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/activite" element={<ActivityPage />} />
              <Route path="/nouvelles" element={<NouvellesPage />} />
              <Route path="/article/:slug" element={<ArticlePage />} />
              <Route path="/compagnies" element={<CompaniesPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      {/* Pop-up d'installation PWA — monte a la racine pour etre present des
          `/` (landing, avant creation de compte) et capter `beforeinstallprompt`
          quelle que soit la route d'arrivee. */}
      <InstallPrompt />
    </BrowserRouter>
  )
}
