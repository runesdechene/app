import { InfoModal } from '../map/modals/InfoModal'
import { DefiTagBadge } from './DefiTagBadge'
import { DefiParticipants } from './DefiParticipants'
import type { Defi } from '../../types/defi'

/** Explication de l'action attendue, par type de défi. */
const ACTION_HINT: Record<Defi['action'], string> = {
  reveal: 'Dépense ton énergie pour révéler ce type de lieu à distance, depuis la carte.',
  visit: 'Rends-toi sur place (GPS) près de ce type de lieu pour valider le défi.',
  veilleur: "Va sur place et plante ton étendard pour devenir le veilleur de ce type de lieu.",
  add: 'Ajoute ce type de lieu à la carte pour la communauté.',
  enigma: "Tente l'énigme du jour.",
}

/**
 * Modale détail d'un défi (jour / semaine / collectif). Réutilise InfoModal,
 * comme l'ancienne DailyQuestModal. Explique le défi + montre la progression + le butin.
 */
export function DefiDetailModal({ defi, onClose }: { defi: Defi; onClose: () => void }) {
  const isCollective = defi.scope === 'collective'
  const progress = Math.min(defi.progress, defi.target)
  const pct = defi.target > 0 ? Math.min(100, Math.round((progress / defi.target) * 100)) : 0

  const description =
    (isCollective ? 'Objectif communautaire — chaque contributeur est récompensé quand la cible est atteinte. ' : '') +
    (ACTION_HINT[defi.action] ?? '')

  const rows: { label: string; value: string; highlight?: boolean }[] = []
  if (isCollective) {
    rows.push({ label: 'La communauté', value: `${progress} / ${defi.target}`, highlight: true })
    rows.push({ label: 'Ta contribution', value: `${defi.myContribution}` })
  } else {
    rows.push({ label: 'Avancement', value: `${progress} / ${defi.target}`, highlight: true })
  }
  rows.push({ label: 'Récompense', value: `+${defi.reward} 🪙 Couronnes` })
  if (defi.claimed) rows.push({ label: 'Statut', value: 'Butin déjà perçu ✓', highlight: true })

  const extra = (
    <>
      <div className="cqc-bar" style={{ marginTop: 4 }}>
        <div className="cqc-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {isCollective && <DefiParticipants defiId={defi.id} />}
    </>
  )

  return (
    <InfoModal
      icon={<DefiTagBadge defi={defi} size={44} />}
      title={defi.title}
      description={description}
      rows={rows}
      onClose={onClose}
      extraContent={extra}
    />
  )
}
