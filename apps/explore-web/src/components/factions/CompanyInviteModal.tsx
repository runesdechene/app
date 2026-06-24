import { useState } from 'react'
import { createPortal } from 'react-dom'
import './CompanyInviteModal.css'

interface Props {
  factionId: string
  factionName: string
  color: string
  /** Rôle de l'inviteur → adapte le ton du message. */
  isChef?: boolean
  isMember?: boolean
  onClose: () => void
}

/**
 * Modale « Inviter des amis » — lien partageable vers la Compagnie. L'invité,
 * après création de compte / connexion, atterrit directement sur la Compagnie
 * (cf. useCompanyInvite : param ?company=<id> ouvre le Hall après auth).
 */
export function CompanyInviteModal({ factionId, factionName, color, isChef, isMember, onClose }: Props) {
  const link = `${window.location.origin}/?company=${factionId}`
  const intro = isChef
    ? `Hey ! ⚔️ Je monte ma Compagnie « ${factionName} » sur Runes de Chêne et on a besoin de toi pour la faire grandir. Rejoins-nous :`
    : isMember
      ? `Hey ! ⚔️ Je fais partie de la Compagnie « ${factionName} » sur Runes de Chêne — viens la rejoindre, on a besoin de toi :`
      : `Hey ! ⚔️ Découvre la Compagnie « ${factionName} » sur Runes de Chêne et rejoins-la :`
  const message = `${intro}\n${link}`
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard indispo → sélection manuelle via le champ
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: factionName, text: intro, url: link })
      } catch { /* annulé */ }
    } else {
      copy()
    }
  }

  return createPortal(
    <div className="cinv-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cinv" style={{ borderTopColor: color }}>
        <button className="cinv-close" onClick={onClose} aria-label="Fermer">×</button>
        <div className="cinv-eyebrow">Inviter des amis</div>
        <h2 className="cinv-title">{factionName}</h2>
        <p className="cinv-text">
          Partage ce lien : tes amis créeront un compte (ou se connecteront) et arriveront
          directement sur la Compagnie pour la rejoindre.
        </p>

        <textarea className="cinv-message" readOnly value={message} rows={4} onFocus={(e) => e.currentTarget.select()} />
        <button className="cinv-copy cinv-copy-full" style={{ background: color }} onClick={copy}>
          {copied ? '✓ Message copié' : '📋 Copier le message'}
        </button>

        <button className="cinv-share" onClick={share}>📤 Partager</button>
      </div>
    </div>,
    document.body,
  )
}
