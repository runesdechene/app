import { InfoModal } from './InfoModal'
import { COUPE_BAREME } from '../../types/coupe'

interface Props {
  onClose: () => void
}

/**
 * V0.7 phase 3 — Règles claires de la Coupe des Héritages.
 * Accessible via icône ⓘ près du toggle "Coupe des Héritages" + lien "Voir
 * règles" dans CoupeModal. Réutilise InfoModal pour l'identité visuelle (même
 * pattern que NotorietyBadge / EnergyIndicator).
 */
export function CoupeRulesModal({ onClose }: Props) {
  return (
    <InfoModal
      icon={'🏆'}
      title="Coupe des Héritages"
      description="Chaque saison, les Héritages s'affrontent dans une compétition saine d'actions personnelles. Tes plantages, tes carnets, tes énigmes résolues — tout compte pour ton Héritage. La faction qui cumule le plus de points à la clôture remporte la Coupe."
      rows={[
        { label: 'Énigme du jour résolue',         value: `+${COUPE_BAREME.enigme} pt` },
        { label: 'Photo ajoutée à un lieu',        value: `+${COUPE_BAREME.photo} pt` },
        { label: 'Carnet écrit sur un lieu',       value: `+${COUPE_BAREME.carnet} pts` },
        { label: 'Plantage de bannière (terrain)', value: `+${COUPE_BAREME.plantage} pts`, highlight: true },
        { label: 'Lieu ajouté',                    value: `+${COUPE_BAREME.lieuAjoute} pts`, highlight: true },
        { label: 'Combo créateur sur place',       value: `${COUPE_BAREME.lieuAjoute + COUPE_BAREME.plantage + COUPE_BAREME.carnet} pts` },
      ]}
      onClose={onClose}
    />
  )
}
