import { useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useFactionGroupStore } from '../../stores/factionGroupStore'
import { useFactionHallStore } from '../../stores/factionHallStore'
import './BannerToggle.css'

/**
 * Toggle de bannière active — à gauche de l'avatar (desktop + mobile).
 * Montre l'emblème de ta Compagnie active. Tap : bascule vers l'autre Compagnie
 * (si tu en as 2), sinon ouvre son Hall. Caché si tu n'as aucune Compagnie.
 */
export function BannerToggle() {
  const userId = usePlayerStore(s => s.userId)
  const myFactions = useFactionGroupStore(s => s.myFactions)
  const activeFactionId = useFactionGroupStore(s => s.activeFactionId)
  const switchBanner = useFactionGroupStore(s => s.switchBanner)
  const loadMine = useFactionGroupStore(s => s.loadMine)
  const openHall = useFactionHallStore(s => s.open)

  useEffect(() => { if (userId) loadMine(userId) }, [userId, loadMine])

  if (!userId || myFactions.length === 0) return null

  const active = myFactions.find(f => f.id === activeFactionId) ?? myFactions[0]
  const multi = myFactions.length > 1

  async function handleClick() {
    if (!userId) return
    if (multi) {
      const idx = myFactions.findIndex(f => f.id === active.id)
      const next = myFactions[(idx + 1) % myFactions.length]
      await switchBanner(userId, next.id)
    } else {
      openHall(active.id)
    }
  }

  return (
    <button
      className="banner-toggle"
      onClick={handleClick}
      title={multi ? `Bannière : ${active.name} — toucher pour changer` : active.name}
      aria-label="Bannière active"
    >
      {active.imageUrl ? (
        <img className="banner-toggle-emblem" src={active.imageUrl} alt="" style={{ borderColor: active.color }} />
      ) : (
        <span className="banner-toggle-emblem banner-toggle-fallback" style={{ background: active.color, borderColor: active.color }}>
          {active.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="banner-toggle-flag" aria-hidden>⚑</span>
    </button>
  )
}
