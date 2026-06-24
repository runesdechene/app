import { useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useFactionGroupStore } from '../../stores/factionGroupStore'
import { useFactionHallStore } from '../../stores/factionHallStore'
import { CompanyEmblem } from './CompanyEmblem'
import './BannerToggle.css'

/**
 * Bannière de la Compagnie principale — à gauche de l'avatar (desktop + mobile).
 * Montre l'emblème de ta Compagnie principale (= active). Tap : ouvre son Hall.
 * Le changement de principale est délibéré (cooldown) depuis le Hall de l'alliée,
 * plus de bascule casual ici. Caché si tu n'as aucune Compagnie.
 */
export function BannerToggle() {
  const userId = usePlayerStore(s => s.userId)
  const myFactions = useFactionGroupStore(s => s.myFactions)
  const activeFactionId = useFactionGroupStore(s => s.activeFactionId)
  const loadMine = useFactionGroupStore(s => s.loadMine)
  const openHall = useFactionHallStore(s => s.open)

  useEffect(() => { if (userId) loadMine(userId) }, [userId, loadMine])

  if (!userId || myFactions.length === 0) return null

  const active = myFactions.find(f => f.id === activeFactionId) ?? myFactions[0]

  return (
    <button
      className="banner-toggle"
      onClick={() => openHall(active.id)}
      title={active.name}
      aria-label="Compagnie principale"
    >
      <CompanyEmblem
        className="banner-toggle-emblem" color={active.color} name={active.name}
        imageUrl={active.imageUrl} emblemIcon={active.emblemIcon} emblemMono={active.emblemMono}
        size={32} radius="50%" style={{ borderColor: active.color }}
      />
      <span className="banner-toggle-flag" aria-hidden>⚑</span>
    </button>
  )
}
