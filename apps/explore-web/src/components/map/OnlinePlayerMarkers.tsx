import { memo, useState } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import { NoteOverlay } from '../social/NoteOverlay'
import { AvatarActionsPopover } from '../social/AvatarActionsPopover'
import { useNoteReactions } from '../../hooks/useNoteReactions'
import { useMapStore } from '../../stores/mapStore'
import './OnlinePlayerMarkers.css'

// Au-dessus de ce zoom : note complète (bulle + texte). Sous ce seuil :
// icône 📜 compacte (la carte reste lisible quand on dézoome large).
const NOTE_FULL_ZOOM_THRESHOLD = 9

interface OnlinePlayer {
  userId: string
  name: string
  avatarUrl: string | null
  factionColor: string | null
  displayedTitles: string[]
  position: { lng: number; lat: number }
  noteText?: string | null
  notePostedAt?: string | null
}

interface Props {
  players: Map<string, OnlinePlayer>
  onSelectPlayer: (id: string) => void
  /** Hissé en prop depuis ExploreMap pour partager l'unique instance de useEmojiThrows
   *  (sinon le state `flying` de l'envoyeur vit dans une instance déconnectée du Layer). */
  throwEmoji: (toUserId: string, emoji: string) => Promise<void>
}

const NOTE_TTL_MS = 24 * 60 * 60 * 1000

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
  // Callback ref via useState : refs natifs ne triggent pas de re-render au mount,
  // donc NoteOverlay/AvatarActionsPopover ne recevaient jamais l'élément ancre.
  const [avatarEl, setAvatarEl] = useState<HTMLDivElement | null>(null)
  const noteIsActive = !!(
    player.noteText &&
    player.notePostedAt &&
    new Date(player.notePostedAt).getTime() > Date.now() - NOTE_TTL_MS
  )

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

      {/* V0.7+ Note éphémère portée vers document.body (compact = icône si zoom large) */}
      {noteIsActive && !isPopoverOpen && (
        <NoteOverlayForPlayer
          anchorEl={avatarEl}
          text={player.noteText!}
          noteUserId={player.userId}
          onTap={onTogglePopover}
        />
      )}

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

function NoteOverlayForPlayer({
  anchorEl, text, noteUserId, onTap,
}: { anchorEl: HTMLElement | null; text: string; noteUserId: string; onTap: () => void }) {
  const { reactions } = useNoteReactions(noteUserId)
  const mapZoom = useMapStore(s => s.mapZoom)
  const compact = mapZoom < NOTE_FULL_ZOOM_THRESHOLD
  return <NoteOverlay anchorEl={anchorEl} text={text} reactions={reactions} onTap={onTap} compact={compact} />
}
