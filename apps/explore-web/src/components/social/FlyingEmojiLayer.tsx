import { useMemo } from 'react'
import type { FlyingEmoji } from '../../hooks/useEmojiThrows'
import './FlyingEmojiLayer.css'

export type AvatarPositionResolver = (userId: string) => { x: number; y: number } | null

interface FlyingEmojiLayerProps {
  flying: FlyingEmoji[]
  resolveAvatar: AvatarPositionResolver
  viewportWidth: number
  viewportHeight: number
}

/**
 * V0.7+ Couche absolue au-dessus de la carte. Anime chaque emoji-throw via offset-path
 * (courbe quadratique en arc, ~1.3 sec). Filtre côté client : au moins 1 endpoint dans le viewport.
 */
export function FlyingEmojiLayer({
  flying,
  resolveAvatar,
  viewportWidth,
  viewportHeight,
}: FlyingEmojiLayerProps) {
  const visible = useMemo(() => {
    const margin = 100
    const inViewport = (p: { x: number; y: number }) =>
      p.x >= -margin && p.x <= viewportWidth + margin &&
      p.y >= -margin && p.y <= viewportHeight + margin

    return flying.flatMap(f => {
      const from = resolveAvatar(f.fromUserId)
      const to = resolveAvatar(f.toUserId)
      if (!from || !to) return []
      if (!inViewport(from) && !inViewport(to)) return []
      const midX = (from.x + to.x) / 2
      const midY = (from.y + to.y) / 2 - 70
      const path = `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`
      return [{ ...f, path }]
    })
  }, [flying, resolveAvatar, viewportWidth, viewportHeight])

  return (
    <div className="flying-emoji-layer">
      {visible.map(f => (
        <div
          key={f.id}
          className="flying-emoji"
          style={{ offsetPath: `path('${f.path}')` } as React.CSSProperties}
        >
          {f.emoji}
        </div>
      ))}
    </div>
  )
}
