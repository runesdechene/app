import { memo, useRef, useState } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import { NoteBubble } from '../social/NoteBubble'
import { NoteReactionsRow } from '../social/NoteReactionsRow'
import { AvatarActionsPopover } from '../social/AvatarActionsPopover'
import { useEmojiThrows } from '../../hooks/useEmojiThrows'
import { useNoteReactions } from '../../hooks/useNoteReactions'
import './OnlinePlayerMarkers.css'

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
}

const NOTE_TTL_MS = 24 * 60 * 60 * 1000

export const OnlinePlayerMarkers = memo(function OnlinePlayerMarkers({ players, onSelectPlayer }: Props) {
  const { throwEmoji } = useEmojiThrows()
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
  const avatarRef = useRef<HTMLDivElement>(null)
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
          ref={avatarRef}
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

        {/* V0.7+ Note éphémère au-dessus de l'avatar (cachée tant que le popover est ouvert) */}
        {noteIsActive && !isPopoverOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'auto',
              zIndex: 4,
              display: 'flex',
              flexDirection: 'column-reverse',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <PlayerReactionsInline noteUserId={player.userId} />
            <NoteBubble
              text={player.noteText!}
              onTap={onTogglePopover}
            />
          </div>
        )}
      </div>

      {isPopoverOpen && (
        <AvatarActionsPopover
          mode="other"
          anchorEl={avatarRef.current}
          onClose={onClosePopover}
          onViewProfile={() => onSelectPlayer(player.userId)}
          onSendEmoji={onSendEmoji}
        />
      )}
    </Marker>
  )
}

function PlayerReactionsInline({ noteUserId }: { noteUserId: string }) {
  const { reactions } = useNoteReactions(noteUserId)
  return <NoteReactionsRow reactions={reactions} />
}
