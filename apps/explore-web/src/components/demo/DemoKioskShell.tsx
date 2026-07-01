// src/components/demo/DemoKioskShell.tsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { useDemoStore } from '../../stores/demoStore'
import { usePlayerStore } from '../../stores/playerStore'
import runeEmblem from '../../assets/rune_de_chene.png'
import './DemoKioskShell.css'

const IDLE_MS = 3 * 60 * 1000 // 3 minutes

export function DemoKioskShell({ children }: { children: React.ReactNode }) {
  const [showIntro, setShowIntro] = useState(true)
  const [showWelcome, setShowWelcome] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const armIdle = useCallback(() => {
    window.clearTimeout(timer.current)
    // Reset propre entre visiteurs : rechargement complet → écran neuf
    // (menu replié, modales fermées, carte recentrée, session démo à zéro).
    timer.current = window.setTimeout(() => window.location.reload(), IDLE_MS)
  }, [])

  // Durcissement kiosque (borne au stand) : pas de zoom page, pas de menu
  // contextuel (appui long), pas de sélection de texte, pas d'overscroll.
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('demo-kiosk')
    const meta = document.querySelector('meta[name="viewport"]')
    const prevViewport = meta?.getAttribute('content') ?? null
    meta?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    const blockContext = (e: Event) => e.preventDefault()
    document.addEventListener('contextmenu', blockContext)
    return () => {
      root.classList.remove('demo-kiosk')
      if (meta && prevViewport !== null) meta.setAttribute('content', prevViewport)
      document.removeEventListener('contextmenu', blockContext)
    }
  }, [])

  useEffect(() => {
    if (showIntro) { window.clearTimeout(timer.current); return }
    const onActivity = () => armIdle()
    armIdle()
    window.addEventListener('pointerdown', onActivity)
    window.addEventListener('scroll', onActivity, true)
    return () => {
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('scroll', onActivity, true)
      window.clearTimeout(timer.current)
    }
  }, [showIntro, armIdle])

  function enter() {
    useDemoStore.getState().reset()
    // Carte vierge pour le prochain visiteur : toggle mode Compagnie OFF + découvertes effacées.
    const player = usePlayerStore.getState()
    player.setFactionColorMode(false)
    player.setDiscoveredIds([])
    setShowIntro(false)
    setShowWelcome(true)
  }

  return (
    <>
      {children}
      {showWelcome && (
        <div className="demo-welcome" onClick={() => setShowWelcome(false)}>
          <div className="demo-welcome-card" onClick={(e) => e.stopPropagation()}>
            <span
              className="demo-welcome-logo"
              style={{ WebkitMaskImage: `url(${runeEmblem})`, maskImage: `url(${runeEmblem})` }}
              aria-hidden="true"
            />
            <h2 className="demo-welcome-title">Bienvenue, <span>Porteur</span></h2>
            <p className="demo-welcome-sub">Runes de Chêne crée une carte vivante de <b>3000+ lieux</b> anciens, magiques ou atypiques de nos régions, ajoutés ou veillés par notre communauté de clients.</p>
            <ul className="demo-welcome-steps">
              <li>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/></svg>
                <b>Explore la carte</b>
              </li>
              <li>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                <b>Découvre des lieux</b>
              </li>
              <li>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/></svg>
                <b>Résous des énigmes</b>
              </li>
            </ul>
            <button className="demo-welcome-cta" onClick={() => setShowWelcome(false)}>C'est parti !</button>
          </div>
        </div>
      )}
      {showIntro && (
        <div className="demo-intro" onClick={enter} role="button" tabIndex={0}>
          <div className="demo-intro-bg" />
          <div className="demo-intro-veil" />
          <div className="demo-intro-content">
            <div className="demo-intro-head">
              <img className="demo-intro-logo" src={runeEmblem} alt="Runes de Chêne" />
              <p className="demo-intro-kicker">L'Histoire comme terrain d'aventure</p>
              <h1 className="demo-intro-title">
                <span className="demo-title-white">Une marque.</span>{' '}
                <span className="demo-title-gold">Une application.</span>
              </h1>
              <p className="demo-intro-tagline">
                La plus grosse communauté francophone jamais fédérée autour de <span className="demo-tag-num">l'Histoire, l'Aventure &amp; la Nature</span> — dans ta poche.
              </p>
            </div>
            <div className="demo-intro-cta-group">
              <svg className="demo-intro-hand" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="demo-hand-ripple" cx="11.5" cy="3.5" r="2.4" />
                <path className="demo-hand-tap" d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6C13 6.67 12.33 6 11.5 6S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.21 0-.62-.38-1.16-.91-1.38z" />
              </svg>
              <button className="demo-intro-cta" onClick={enter}>Touche l'écran pour essayer l'app</button>
              <div className="demo-intro-stand">
                <svg className="demo-stand-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z" />
                </svg>
                <span>
                  Chaque pièce achetée au stand débloque son <b>Fragment d'Histoire</b> dans l'app — comme un équipement.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
