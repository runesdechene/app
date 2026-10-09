/**
 * QUOI     — « Signaler une erreur » sur une énigme : des raisons selon où en est le joueur, un mot, la
 *            bonne réponse qu'il propose s'il croit le contenu faux, puis un merci.
 * POURQUOI — les joueurs trouvaient les énigmes trop strictes (« Eudes » pour « Eudes de Paris ») : ce
 *            qu'ils contestent arrive dans le Hub (spec du 08/10, mig 470). Depuis le 09/10 (mig 472), on
 *            signale aussi avant de répondre, si l'énoncé est faux ; « refusée » n'a de sens qu'après un
 *            « Pas cette fois ».
 */
import { FeuilleDeSignalement, type Raison } from '@/shared/ui/FeuilleDeSignalement'
import { signalerEnigme, type RaisonEnigme } from '../api/enigmes'

export type OuEnEst = 'avant' | 'juste' | 'faux'

const REFUSEE: Raison<RaisonEnigme> = { id: 'reponse_refusee', libelle: 'Ma réponse aurait dû être acceptée' }
const ENONCE: Raison<RaisonEnigme> = { id: 'erreur', libelle: 'L’énoncé est faux ou ambigu' }
const CONTENU: Raison<RaisonEnigme> = { id: 'erreur', libelle: 'L’énoncé, la réponse ou l’explication est faux' }
const AUTRE: Raison<RaisonEnigme> = { id: 'autre', libelle: 'Autre chose' }

const RAISONS: Record<OuEnEst, Raison<RaisonEnigme>[]> = {
  avant: [ENONCE, AUTRE],
  juste: [CONTENU, AUTRE],
  faux: [REFUSEE, CONTENU, AUTRE],
}

export function FeuilleSignalerEnigme({
  numero,
  ouEnEst,
  onFermer,
}: {
  numero: number
  ouEnEst: OuEnEst
  onFermer: () => void
}) {
  return (
    <FeuilleDeSignalement
      titre="Signaler une erreur"
      consigne="Qu’est-ce qui ne va pas ? L’équipe regarde chaque signalement."
      raisons={RAISONS[ouEnEst]}
      merci="L’équipe va regarder cette énigme de près."
      proposition={{ pour: 'erreur', libelle: 'Quelle serait la bonne réponse ?' }}
      onEnvoyer={(raison, precision, proposition) => signalerEnigme(numero, raison, precision, proposition)}
      onFermer={onFermer}
    />
  )
}
