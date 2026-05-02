import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EmojiPicker } from './EmojiPicker'
import { useUserNote } from '../../hooks/useUserNote'
import { usePlayerStore } from '../../stores/playerStore'
import './AvatarActionsPopover.css'

type Mode = 'self' | 'other'
type SubView = 'menu' | 'note' | 'picker'

interface PropsBase {
  mode: Mode
  /**
   * Élément DOM de l'avatar à ancrer. Le popover sera positionné en `fixed` au-dessus
   * de cet élément, rendu via createPortal vers document.body pour échapper au DOM
   * du Marker MapLibre (qui interceptait clavier/souris/wheel).
   */
  anchorEl: HTMLElement | null
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
 * Rendu via createPortal au document.body pour que le textarea/inputs reçoivent
 * correctement les events natifs (caret au clic, navigation aux flèches, sélection)
 * sans interception par MapLibre. Suit l'avatar via requestAnimationFrame loop tant
 * qu'il est ouvert (suit le pan/zoom de la carte naturellement).
 */
export function AvatarActionsPopover(props: Props) {
  const [view, setView] = useState<SubView>('menu')
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const ownNoteText = usePlayerStore(s => s.ownNoteText)
  const hasNote = props.mode === 'self' && !!ownNoteText

  // Suit la position de l'avatar en continu (tolère pan/zoom de la carte)
  useEffect(() => {
    if (!props.anchorEl) {
      setPos(null)
      return
    }
    let frame = 0
    function tick() {
      const rect = props.anchorEl?.getBoundingClientRect()
      if (rect) {
        setPos({ left: rect.left + rect.width / 2, top: rect.top })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [props.anchorEl])

  // Click outside ferme — sauf clic sur le picker (qui est nested) ou sur l'avatar
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (popoverRef.current?.contains(target)) return
      if (target.closest('.other-player-marker') || target.closest('.user-position-marker')) return
      props.onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [props])

  if (!pos) return null

  const node = (
    <div
      ref={popoverRef}
      className="avatar-actions-popover"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top - 12,
        transform: 'translate(-50%, -100%)',
        zIndex: 10000,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') props.onClose()
      }}
      onWheel={(e) => e.stopPropagation()}
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
          }}
        />
      )}
    </div>
  )

  return createPortal(node, document.body)
}

/** Sous-composant : édition rapide de la note du moment (200 chars max, 24h). */
function NoteEditor({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { note, setNoteText, clearNote } = useUserNote()
  const [draft, setDraft] = useState(note.text ?? '')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Synchronise quand la note arrive après mount
  useEffect(() => {
    setDraft(note.text ?? '')
  }, [note.text])

  // Focus + caret en fin de texte au mount (pour qu'on tape directement la suite)
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    const len = ta.value.length
    ta.setSelectionRange(len, len)
  }, [])

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
        ref={textareaRef}
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
