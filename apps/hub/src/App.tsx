import { Routes, Route, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './components/LoginPage'
import { Dashboard } from './components/Dashboard'
import { Users } from './components/Users'
import { UserDetail } from './components/UserDetail'
import { Photos } from './components/Photos'
import { StudioSubmit } from './components/StudioSubmit'
import { FlyerGift } from './components/FlyerGift'
import { FlyerLinks } from './components/FlyerLinks'
import { TagsManager } from './components/TagsManager'
import { Factions } from './components/Factions'
import { TitlesManager } from './components/TitlesManager'
import { Divers } from './components/Divers'
import { LandingConfig } from './components/LandingConfig'
import { Fragments } from './components/Fragments'
import { AssignFragments } from './components/AssignFragments'
import { ShopifyUnlocks } from './components/ShopifyUnlocks'
import { Ads } from './components/Ads'
import { Banners } from './components/Banners'
import { Enigmas } from './components/Enigmas'
import { Missions } from './components/Missions'
import { Settings } from './components/Settings'
import { GameRules } from './components/GameRules'
import { TutorialManager } from './components/TutorialManager'
import { ShopifySync } from './components/ShopifySync'
import { AnnouncementsList } from './components/annonces/AnnouncementsList'
import { ComposerAnnonce } from './components/annonces/ComposerAnnonce'
import { Sidebar } from './components/Sidebar'
import './App.css'

function AccessDenied({ onSignOut, email, role }: { onSignOut: () => void; email?: string; role?: string | null }) {
  return (
    <div className="access-denied">
      <h1>Accès refusé</h1>
      <p>Cette zone est réservée aux administrateurs de Runes de Chêne.</p>
      <p style={{ fontSize: '12px', opacity: 0.5, marginTop: '16px' }}>
        Email : {email ?? '?'} — Rôle : {role ?? 'null'}
      </p>
      <button onClick={onSignOut}>Se déconnecter</button>
    </div>
  )
}

function App() {
  const { user, role, loading, isAuthenticated, isAdmin, signOut } = useAuth()
  const location = useLocation()

  // Routes publiques (pas besoin d'auth)
  const publicRoutes = ['/soumettre-contenu', '/flyercadeau', '/flyer']
  const isPublicRoute = publicRoutes.includes(location.pathname)

  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/soumettre-contenu" element={<StudioSubmit />} />
        <Route path="/flyercadeau" element={<FlyerGift />} />
        <Route path="/flyer" element={<FlyerLinks />} />
      </Routes>
    )
  }

  if (loading) {
    return (
      <div className="app loading">
        <div className="spinner" />
        <p>Chargement...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  if (!isAdmin) {
    return <AccessDenied onSignOut={signOut} email={user?.email} role={role} />
  }

  return (
    <div className="app">
      <Sidebar user={user} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:userId" element={<UserDetail />} />
          <Route path="/photos" element={<Photos />} />
          <Route path="/carte/tags" element={<TagsManager />} />
          <Route path="/carte/factions" element={<Factions />} />
          <Route path="/carte/titres" element={<TitlesManager />} />
          <Route path="/carte/fragments" element={<Fragments />} />
          <Route path="/carte/associer" element={<AssignFragments />} />
          <Route path="/carte/shopify" element={<ShopifyUnlocks />} />
          <Route path="/carte/publicites" element={<Ads />} />
          <Route path="/carte/bannieres" element={<Banners />} />
          <Route path="/carte/enigmes" element={<Enigmas />} />
          <Route path="/carte/missions" element={<Missions />} />
          <Route path="/carte/reglages" element={<Settings />} />
          <Route path="/carte/divers" element={<Divers />} />
          <Route path="/carte/landing" element={<LandingConfig />} />
          <Route path="/carte/regles" element={<GameRules />} />
          <Route path="/carte/tutoriel" element={<TutorialManager />} />
          <Route path="/shopify/sync" element={<ShopifySync />} />
          <Route path="/annonces" element={<AnnouncementsList />} />
          <Route path="/annonces/nouvelle" element={<ComposerAnnonce />} />
          <Route path="/annonces/:id" element={<ComposerAnnonce />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
