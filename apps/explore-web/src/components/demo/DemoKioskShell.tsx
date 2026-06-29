// src/components/demo/DemoKioskShell.tsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { useDemoStore } from '../../stores/demoStore'
import { usePlayerStore } from '../../stores/playerStore'
import './DemoKioskShell.css'

const IDLE_MS = 10 * 60 * 1000 // 10 minutes

export function DemoKioskShell({ children }: { children: React.ReactNode }) {
  const [showIntro, setShowIntro] = useState(true)
  const [showWelcome, setShowWelcome] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const armIdle = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShowIntro(true), IDLE_MS)
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
            <h2>Bienvenue dans le mouvement Runes de Chêne</h2>
            <p>Explore la carte, découvre des lieux, résous des énigmes. Amuse-toi !</p>
            <button onClick={() => setShowWelcome(false)}>Commencer</button>
          </div>
        </div>
      )}
      {showIntro && (
        <div className="demo-intro">
          <div className="demo-intro-veil" />
          <div className="demo-intro-content">
            <h1>Runes de Chêne</h1>
            <button className="demo-intro-cta" onClick={enter}>Entrer sur la carte</button>
          </div>
        </div>
      )}
    </>
  )
}
