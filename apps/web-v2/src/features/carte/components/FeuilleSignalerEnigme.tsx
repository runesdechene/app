/**
 * QUOI     — « Signaler une erreur » sur une énigme : trois raisons, un mot, puis un merci.
 * POURQUOI — les joueurs trouvaient les énigmes trop strictes (« Eudes » pour « Eudes de Paris ») : ce
 *            qu'ils contestent arrive dans le Hub, qui peut accepter leur réponse (spec du 08/10, mig 465).
 */
import { FeuilleDeSignalement, type Raison } from '@/shared/ui/FeuilleDeSignalement'
import { signalerEnigme, type RaisonEnigme } from '../api/enigmes'

const RAISONS: Raison<RaisonEnigme>[] = [
  { id: 'reponse_refusee', libelle: 'Ma réponse aurait dû être acceptée' },
  { id: 'erreur', libelle: 'La réponse ou l’explication est fausse' },
  { id: 'autre', libelle: 'Autre chose' },
]

export function FeuilleSignalerEnigme({ numero, onFermer }: { numero: number; onFermer: () => void }) {
  return (
    <FeuilleDeSignalement
      titre="Signaler une erreur"
      consigne="Qu’est-ce qui ne va pas ? L’équipe regarde chaque signalement."
      raisons={RAISONS}
      merci="L’équipe va regarder cette énigme de près."
      onEnvoyer={(raison, precision) => signalerEnigme(numero, raison, precision)}
      onFermer={onFermer}
    />
  )
}
