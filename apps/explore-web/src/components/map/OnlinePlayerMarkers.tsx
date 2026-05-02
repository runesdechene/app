import { memo, useState } from 'react'
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
      {Array.from(players.values()).map(player => {
        const noteIsActive = player.noteText && player.notePostedAt &&
          new Date(player.notePostedAt).getTime() > Date.now() - NOTE_TTL_MS
        const showPopover = popoverFor === player.userId

        return (
          <Marker
            key={player.userId}
            longitude={player.position.lng}
            latitude={player.position.lat}
            anchor="center"
          >
            <div className="other-player-marker-wrap" style={{ position: 'relative' }}>
              <div
                className="other-player-marker"
                style={{ '--faction-color': player.factionColor ?? '#888' } as React.CSSProperties}
                onClick={(e) => {
                  e.stopPropagation()
                  setPopoverFor(prev => prev === player.userId ? null : player.userId)
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

              {/* V0.7+ Note éphémère au-dessus de l'avatar (réactions sous la bulle, près de l'avatar) */}
              {noteIsActive && (
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
                    authorName={player.name}
                    text={player.noteText!}
                    onTap={() => onSelectPlayer(player.userId)}
                  />
                </div>
              )}

              {/* V0.7+ Mini popover d'actions (Voir profil / Envoyer emoji) */}
              {showPopover && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 12px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                  }}
                >
                  <AvatarActionsPopover
                    mode="other"
                    onClose={() => setPopoverFor(null)}
                    onViewProfile={() => onSelectPlayer(player.userId)}
                    onSendEmoji={(emoji) => { void throwEmoji(player.userId, emoji) }}
                  />
                </div>
              )}
            </div>
          </Marker>
        )
      })}
    </>
  )
})

function PlayerReactionsInline({ noteUserId }: { noteUserId: string }) {
  const { reactions } = useNoteReactions(noteUserId)
  return <NoteReactionsRow reactions={reactions} />
}
