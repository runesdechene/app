import { useEffect, useRef, useState } from 'react'
import { EmojiPicker } from './EmojiPicker'
import { useUserNote } from '../../hooks/useUserNote'
import { usePlayerStore } from '../../stores/playerStore'
import './AvatarActionsPopover.css'

type Mode = 'self' | 'other'
type SubView = 'menu' | 'note' | 'picker'

interface PropsBase {
  mode: Mode
  onClose: () => void
  onViewProfile: () => void
}

interface PropsSelf extends PropsBase {
  mode: 'self'
}

interface PropsOther extends PropsBase {
  mode: 'other'
  onSendEmoji: (emoji: string) => void
}

type Props = PropsSelf | PropsOther

/**
 * V0.7+ Mini popover qui s'ouvre au tap d'un avatar sur la carte.
 * - Mode self  : "Voir le profil" + "Laisser une note" (textarea inline)
 * - Mode other : "Voir le profil" + "Envoyer un emoji" (picker inline)
 *
 * Click outside ferme. ESC ferme.
 */
export function AvatarActionsPopover(props: Props) {
  const [view, setView] = useState<SubView>('menu')
  const popoverRef = useRef<HTMLDivElement>(null)
  const ownNoteText = usePlayerStore(s => s.ownNoteText)
  const hasNote = props.mode === 'self' && !!ownNoteText

  // Click outside ferme — sauf clic sur le picker (qui est nested)
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (popoverRef.current?.contains(target)) return
      // L'avatar lui-même ne doit pas fermer (le toggle est géré par le parent)
      if (target.closest('.other-player-marker') || target.closest('.user-position-marker')) return
      props.onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [props])

  return (
    <div
      ref={popoverRef}
      className="avatar-actions-popover"
      // stopPropagation pour que la carte MapLibre n'intercepte pas le clavier (flèches → pan),
      // la souris (clic → place caret), le wheel (zoom carte) et le touch.
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') props.onClose()
      }}
      onWheel={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {view === 'menu' && (
        <>
          <button
            type="button"
            className="avatar-actions-popover__btn"
            onClick={() => {
              props.onViewProfile()
              props.onClose()
            }}
          >
            👁️ Voir le profil
          </button>

          {props.mode === 'self' ? (
            <button
              type="button"
              className="avatar-actions-popover__btn"
              onClick={() => setView('note')}
            >
              📜 {hasNote ? 'Changer ma note' : 'Laisser un mot'}
            </button>
          ) : (
            <button
              type="button"
              className="avatar-actions-popover__btn"
              onClick={() => setView('picker')}
            >
              👋 Envoyer un emoji
            </button>
          )}

          <button
            type="button"
            className="avatar-actions-popover__btn avatar-actions-popover__btn-cancel"
            onClick={props.onClose}
          >
            Fermer
          </button>
        </>
      )}

      {view === 'note' && props.mode === 'self' && (
        <NoteEditor onDone={props.onClose} onBack={() => setView('menu')} />
      )}

      {view === 'picker' && props.mode === 'other' && (
        <EmojiPicker
          onPick={(emoji) => {
            props.onSendEmoji(emoji)
            // Picker reste ouvert pour le surclick (rafale)
          }}
        />
      )}
    </div>
  )
}

/** Sous-composant : édition rapide de la note du moment (200 chars max, 24h). */
function NoteEditor({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { note, setNoteText, clearNote } = useUserNote()
  const [draft, setDraft] = useState(note.text ?? '')
  const [saving, setSaving] = useState(false)

  // Synchronise quand la note arrive après mount
  useEffect(() => {
    setDraft(note.text ?? '')
  }, [note.text])

  async function save() {
    const next = draft.trim()
    const current = note.text ?? ''
    if (next === current) {
      onDone()
      return
    }
    setSaving(true)
    try {
      if (next.length === 0) await clearNote()
      else await setNoteText(next)
      onDone()
    } catch (err) {
      console.warn('[NoteEditor] save failed', err)
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    setSaving(true)
    try {
      await clearNote()
      setDraft('')
      onDone()
    } catch (err) {
      console.warn('[NoteEditor] clear failed', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="avatar-actions-popover__note-edit">
      <label>Mon mot du moment</label>
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, 200))}
        maxLength={200}
        disabled={saving}
        placeholder="Un mot que les autres voyageurs verront 24h…"
      />
      <div className="avatar-actions-popover__note-edit-meta">
        <span>{draft.length}/200</span>
        {note.text && (
          <button
            type="button"
            onClick={clear}
            disabled={saving}
            style={{
              background: 'none', border: 'none', color: '#8a4a4a',
              fontSize: 12, cursor: 'pointer', padding: 0,
            }}
          >
            Effacer
          </button>
        )}
      </div>
      <div className="avatar-actions-popover__note-edit-actions">
        <button type="button" onClick={onBack} disabled={saving}>
          Retour
        </button>
        <button type="button" className="primary" onClick={save} disabled={saving}>
          {saving ? '…' : 'Poser'}
        </button>
      </div>
    </div>
  )
}
