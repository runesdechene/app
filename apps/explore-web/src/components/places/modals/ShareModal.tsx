import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './ShareModal.css'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  fullText: string
}

export function ShareModal({ isOpen, onClose, fullText }: ShareModalProps) {
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-sélection à l'ouverture
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.select()
    }
    if (!isOpen) setCopied(false)
  }, [isOpen])

  // Echap pour fermer
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch {
      // clipboard non disponible — textarea déjà sélectionnée, user peut Ctrl+C
    }
  }

  return createPortal(
    <div className="share-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <h3>Partager ce lieu</h3>
        <textarea
          ref={textareaRef}
          readOnly
          value={fullText}
          rows={4}
          className="share-modal-textarea"
          onClick={e => (e.target as HTMLTextAreaElement).select()}
        />
        <div className="share-modal-actions">
          <button className="share-modal-cancel" onClick={onClose}>Fermer</button>
          <button className="share-modal-copy" onClick={handleCopy}>
            {copied ? '✓ Copié' : 'Copier dans le presse-papier'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
