import { InfoModal } from './InfoModal'
import { useGloryRulesStore } from '../../../stores/gloryRulesStore'

interface Props {
  onClose: () => void
  /** Si défini, ajoute un bouton "Voir les scores" en bas qui ouvre la
   * CoupeModal (tableau interactif des scores Maisons / joueurs).
   * Utilisé depuis la StatsBar de la home pour offrir un parcours en 2 temps :
   * comprendre le barème puis voir le classement live. */
  onOpenScores?: () => void
}

/**
 * V0.7 phase 3 — Règles claires de la Coupe des Héritages.
 * Accessible via icône ⓘ près du toggle "Coupe des Héritages" + lien depuis CoupeModal.
 *
 * Énigmes : +1 fixe quelle que soit la difficulté (anti-triche, on n'incite
 * pas à chercher les hard en ligne). Toutes les valeurs viennent du store
 * useGloryRulesStore (mig 067) — éditable depuis le Hub admin.
 */
export function CoupeRulesModal({ onClose, onOpenScores }: Props) {
  const get = useGloryRulesStore(s => s.get)
  const visite   = get('coupe.visit_gps')
  const plantage = get('coupe.plant_flag')
  const lieu     = get('coupe.add_place')
  const enigme   = get('coupe.enigma_easy') // valeur "fixe" (toutes diff. = même)

  return (
    <InfoModal
      icon={'🏆'}
      title={'Coupe des Factions'}
      description={'Chaque saison, les Factions s\'affrontent dans une compétition saine d\'actions personnelles. Tes plantages, tes visites, tes énigmes résolues — tout compte pour ta Faction. La Faction qui cumule le plus de points à la clôture remporte la Coupe. Même formule que la Gloire à vie, sur la fenêtre de la saison.'}
      rows={[
        { label: 'Visite GPS d\'un nouveau lieu',  value: `+${visite} pt${visite > 1 ? 's' : ''}` },
        { label: 'Énigme résolue (toute diff.)',   value: `+${enigme} pt${enigme > 1 ? 's' : ''}` },
        { label: 'Plantage de bannière (terrain)', value: `+${plantage} pt${plantage > 1 ? 's' : ''}`, highlight: true },
        { label: 'Lieu ajouté',                    value: `+${lieu} pt${lieu > 1 ? 's' : ''}`, highlight: true },
        { label: 'Combo créateur sur place',       value: `${visite + lieu + plantage} pts` },
      ]}
      onClose={onClose}
      action={onOpenScores ? { label: 'Voir les scores', onClick: onOpenScores } : undefined}
    />
  )
}
