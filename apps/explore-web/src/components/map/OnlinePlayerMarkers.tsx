import { memo, useEffect, useState } from 'react'
import { Marker } from '@vis.gl/react-maplibre'
import { NoteBubble } from '../social/NoteBubble'
import { NoteReactionsRow } from '../social/NoteReactionsRow'
import { EmojiPicker } from '../social/EmojiPicker'
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
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  // Tap dehors → fermer picker
  useEffect(() => {
    if (!pickerFor) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('.emoji-picker') || target.closest('.other-player-marker')) return
      setPickerFor(null)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [pickerFor])

  return (
    <>
      {Array.from(players.values()).map(player => {
        const noteIsActive = player.noteText && player.notePostedAt &&
          new Date(player.notePostedAt).getTime() > Date.now() - NOTE_TTL_MS
        const showPicker = pickerFor === player.userId

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
                  setPickerFor(prev => prev === player.userId ? null : player.userId)
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

              {/* V0.7+ Note éphémère sous l'avatar */}
              {noteIsActive && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'auto',
                    zIndex: 4,
                  }}
                >
                  <NoteBubble
                    authorName={player.name}
                    text={player.noteText!}
                    onTap={() => onSelectPlayer(player.userId)}
                  />
                  <PlayerReactionsInline noteUserId={player.userId} />
                </div>
              )}

              {/* V0.7+ Picker emoji au tap */}
              {showPicker && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                  }}
                >
                  <EmojiPicker
                    onPick={(emoji) => {
                      void throwEmoji(player.userId, emoji)
                      // picker reste ouvert pour surclick
                    }}
                  />
                  <div style={{
                    display: 'flex', gap: 4, marginTop: 4, justifyContent: 'center',
                  }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPickerFor(null)
                        onSelectPlayer(player.userId)
                      }}
                      style={{
                        background: '#fff', border: '1px solid #d4a574',
                        borderRadius: 6, padding: '3px 10px', fontSize: 12,
                        cursor: 'pointer', color: '#3a2a1a',
                      }}
                    >
                      👁️ Voir le profil
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPickerFor(null)
                      }}
                      style={{
                        background: '#fff', border: '1px solid #d4a574',
                        borderRadius: 6, padding: '3px 10px', fontSize: 12,
                        cursor: 'pointer', color: '#3a2a1a',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Marker>
        )
      })}
    </>
  )
})

/** Mini composant inline qui fetch et rend les compteurs de réactions sous une note */
function PlayerReactionsInline({ noteUserId }: { noteUserId: string }) {
  const { reactions } = useNoteReactions(noteUserId)
  return <NoteReactionsRow reactions={reactions} />
}
