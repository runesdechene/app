import { useState } from 'react'
import { createPortal } from 'react-dom'
import './CompanyInviteModal.css'

interface Props {
  factionId: string
  factionName: string
  color: string
  onClose: () => void
}

/**
 * Modale « Inviter des amis » — lien partageable vers la Compagnie. L'invité,
 * après création de compte / connexion, atterrit directement sur la Compagnie
 * (cf. useCompanyInvite : param ?company=<id> ouvre le Hall après auth).
 */
export function CompanyInviteModal({ factionId, factionName, color, onClose }: Props) {
  const link = `${window.location.origin}/?company=${factionId}`
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard indispo → sélection manuelle via l'input
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: factionName,
          text: `Rejoins ma Compagnie « ${factionName} » sur Runes de Chêne !`,
          url: link,
        })
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

        <div className="cinv-linkrow">
          <input className="cinv-link" type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <button className="cinv-copy" style={{ background: color }} onClick={copy}>
            {copied ? '✓ Copié' : 'Copier'}
          </button>
        </div>

        <button className="cinv-share" onClick={share}>📤 Partager le lien</button>
      </div>
    </div>,
    document.body,
  )
}
