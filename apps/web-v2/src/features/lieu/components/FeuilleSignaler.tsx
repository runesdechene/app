/**
 * QUOI     — la feuille « Signaler ce lieu » (maquette « Lieu — signaler », 30/09) : cinq raisons,
 *            un mot facultatif, « Envoyer le signalement » ; puis un merci.
 * POURQUOI — ce que Modifier ne répare pas (un lieu qui n'existe pas, un doublon, un endroit
 *            dangereux) part à l'équipe, qui le voit dans le Hub (mig 387).
 */
import { FeuilleDeSignalement, type Raison as RaisonAffichee } from '@/shared/ui/FeuilleDeSignalement'
import { signalerLieu, type Raison } from '../api/lieu'

const RAISONS: RaisonAffichee<Raison>[] = [
  { id: 'n_existe_pas', libelle: 'Il n’existe pas, ou plus' },
  { id: 'prive_ou_dangereux', libelle: 'Il est privé, ou dangereux d’accès' },
  { id: 'doublon', libelle: 'C’est un doublon d’un autre lieu' },
  { id: 'contenu', libelle: 'Le récit ou les photos posent problème' },
  { id: 'autre', libelle: 'Autre chose' },
]

export function FeuilleSignaler({ id, onFermer }: { id: string; onFermer: () => void }) {
  return (
    <FeuilleDeSignalement
      titre="Signaler ce lieu"
      consigne="Qu’est-ce qui ne va pas ? L’équipe regarde chaque signalement."
      raisons={RAISONS}
      merci="L’équipe va regarder ce lieu de près."
      onEnvoyer={(raison, precision) => signalerLieu(id, raison, precision)}
      onFermer={onFermer}
    />
  )
}
