import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import MapPage from './pages/MapPage'
import LandingPage from './components/landing/LandingPage'
import RequireAuth from './components/RequireAuth'
import { InstallPrompt } from './components/pwa/InstallPrompt'
import { AppLoader } from './components/AppLoader'
import { useIsDesktop } from './hooks/useMediaQuery'
import { isDemoMode } from './lib/demo/isDemoMode'
import { DemoKioskShell } from './components/demo/DemoKioskShell'
import { useDemoBootstrap } from './hooks/useDemoBootstrap'

const MobileLayout = lazy(() => import('./pages/MobileLayout'))
const HomePage = lazy(() => import('./pages/HomePage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const ActivityPage = lazy(() => import('./pages/ActivityPage'))
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'))
const NouvellesPage = lazy(() => import('./pages/NouvellesPage'))
const ArticlePage = lazy(() => import('./pages/ArticlePage'))

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
  const demo = isDemoMode()
  useDemoBootstrap()

  // Lien d'invitation Compagnie : capturer ?company=<id> dès le chargement (même
  // déconnecté sur la LandingPage) → consommé après auth par useCompanyInvite.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('company')
    if (id) {
      sessionStorage.setItem('pendingCompanyInvite', id)
      window.history.replaceState({}, '', window.location.pathname + window.location.hash)
    }
  }, [])

  const tree = (
    <BrowserRouter>
      <Suspense fallback={<AppLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/post-login" element={<RootRedirect />} />
            <Route path="/carte" element={<MapPage />} />
            <Route element={<MobileOnly><MobileLayout /></MobileOnly>}>
              <Route path="/accueil" element={<HomePage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/activite" element={<ActivityPage />} />
              <Route path="/compagnies" element={<CompaniesPage />} />
              <Route path="/nouvelles" element={<NouvellesPage />} />
              <Route path="/article/:slug" element={<ArticlePage />} />
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

  return demo ? <DemoKioskShell>{tree}</DemoKioskShell> : tree
}
