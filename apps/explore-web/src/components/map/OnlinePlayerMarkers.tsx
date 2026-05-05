import { memo, useState } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import { AvatarActionsPopover } from '../social/AvatarActionsPopover'
import './OnlinePlayerMarkers.css'

interface OnlinePlayer {
  userId: string
  name: string
  avatarUrl: string | null
  factionColor: string | null
  displayedTitles: string[]
  position: { lng: number; lat: number }
}

interface Props {
  players: Map<string, OnlinePlayer>
  onSelectPlayer: (id: string) => void
  /** Hissé en prop depuis ExploreMap pour partager l'unique instance de useEmojiThrows
   *  (sinon le state `flying` de l'envoyeur vit dans une instance déconnectée du Layer). */
  throwEmoji: (toUserId: string, emoji: string) => Promise<void>
}

export const OnlinePlayerMarkers = memo(function OnlinePlayerMarkers({ players, onSelectPlayer, throwEmoji }: Props) {
  const [popoverFor, setPopoverFor] = useState<string | null>(null)

  return (
    <>
      {Array.from(players.values()).map(player => (
        <OtherPlayerMarker
          key={player.userId}
          player={player}
          isPopoverOpen={popoverFor === player.userId}
          onTogglePopover={() => setPopoverFor(prev => prev === player.userId ? null : player.userId)}
          onClosePopover={() => setPopoverFor(null)}
          onSelectPlayer={onSelectPlayer}
          onSendEmoji={(emoji) => { void throwEmoji(player.userId, emoji) }}
        />
      ))}
    </>
  )
})

interface SubProps {
  player: OnlinePlayer
  isPopoverOpen: boolean
  onTogglePopover: () => void
  onClosePopover: () => void
  onSelectPlayer: (id: string) => void
  onSendEmoji: (emoji: string) => void
}

function OtherPlayerMarker({
  player,
  isPopoverOpen,
  onTogglePopover,
  onClosePopover,
  onSelectPlayer,
  onSendEmoji,
}: SubProps) {
  const [avatarEl, setAvatarEl] = useState<HTMLDivElement | null>(null)

  return (
    <Marker
      longitude={player.position.lng}
      latitude={player.position.lat}
      anchor="center"
    >
      <div className="other-player-marker-wrap" style={{ position: 'relative' }}>
        <div
          ref={setAvatarEl}
          className="other-player-marker"
          style={{ '--faction-color': player.factionColor ?? '#888' } as React.CSSProperties}
          onClick={(e) => {
            e.stopPropagation()
            onTogglePopover()
          }}
        >
          {player.avatarUrl ? (
            <img src={player.avatarUrl} alt="" className="other-player-avatar" />
          ) : (
            <div className="other-player-dot" />
          )}
          <span className="other-player-name">{player.name}</span>
          {player.displayedTitles.map((title, i) => (
            <span key={i} className="other-player-title">{title}</span>
          ))}
        </div>
      </div>

      {isPopoverOpen && (
        <AvatarActionsPopover
          mode="other"
          anchorEl={avatarEl}
          onClose={onClosePopover}
          onViewProfile={() => onSelectPlayer(player.userId)}
          onSendEmoji={onSendEmoji}
        />
      )}
    </Marker>
  )
}
