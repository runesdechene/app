/**
 * QUOI     — envoyer au serveur les pins posés dans le téléphone.
 * POURQUOI — un pin naît hors ligne (pinsEnAttente) ; il part au lancement, au retour du réseau et
 *            à l'ouverture du « + » (hooks/usePins). Le lieu-dit se cherche maintenant, faute de
 *            réseau à la pose ; sans réponse du géocodeur, le pin part sans.
 * ATTENTION — seuls les refus propres de `poser_pin` sont définitifs : 22023 (position impossible)
 *            et P0001 (GPS trop imprécis). Le pin reste alors dans le téléphone et l'écran le
 *            signale, il n'est jamais jeté en silence. Une date « dans le futur » (22023, indice
 *            `date`) vient d'une horloge de téléphone en avance : réessayée plus tard, elle passe.
 *            Tout autre échec (coupure, jeton expiré PGRST301, connexion requise 42501, panne
 *            serveur) arrête l'envoi sans rien marquer : on réessaiera.
 *            Seuls les pins du compte connecté partent ; ceux d'un autre compte attendent le leur.
 *            Un pin supprimé pendant son envoi ne revient pas : accepté entre-temps, il est
 *            supprimé du serveur aussi.
 *            Un seul envoi à la fois : les appels simultanés (lancement, retour du réseau, pose)
 *            partagent le même, sinon un pin partirait deux fois ; ils en réclament une passe de
 *            plus, pour le pin posé pendant que la première lisait sa liste.
 */
import { endroitDe } from '@/shared/lib/adresse'
import { monIdentifiant, poserPin, supprimerPin } from '../api/pins'
import { estAMoi, lirePinsEnAttente, marquerRefuse, retirerPinEnAttente } from './pinsEnAttente'

export type Envoi = { envoyes: number; refuses: string[] }

const REFUS_DE_POSER_PIN = ['22023', 'P0001']

type Echec = 'refus' | 'plus-tard' | 'arret'

function echec(e: unknown): Echec {
  if (typeof e !== 'object' || e === null || !('code' in e) || typeof e.code !== 'string') return 'arret'
  if (!REFUS_DE_POSER_PIN.includes(e.code)) return 'arret'
  // L'horloge du téléphone en avance : ce pin repassera, les suivants peuvent partir.
  return 'hint' in e && e.hint === 'date' ? 'plus-tard' : 'refus'
}

async function envoyer(): Promise<Envoi> {
  const envoi: Envoi = { envoyes: 0, refuses: [] }
  const moi = await monIdentifiant()
  if (!moi) return envoi // pas de session : les pins attendent la prochaine connexion
  for (const p of await lirePinsEnAttente()) {
    if (p.refuse || !estAMoi(p, moi)) continue
    const lieuDit = await endroitDe({ latitude: p.latitude, longitude: p.longitude })
      .then((e) => e.titre)
      .catch(() => null)
    try {
      await poserPin(p, lieuDit)
    } catch (e) {
      const raison = echec(e)
      if (raison === 'arret') return envoi
      if (raison === 'refus' && (await marquerRefuse(p.id))) envoi.refuses.push(p.id)
      continue
    }
    if (await retirerPinEnAttente(p.id)) envoi.envoyes += 1
    // Supprimé dans le téléphone pendant son envoi : on ne le laisse pas vivre au serveur.
    else await supprimerPin(p.id).catch(() => undefined)
  }
  return envoi
}

let enCours: Promise<Envoi> | null = null
let aRefaire = false

// Un appel arrivé pendant un envoi (un pin posé entre-temps) lève `aRefaire` : une passe de plus
// part avant de rendre la main, car la passe en cours a peut-être déjà lu la liste.
async function passes(): Promise<Envoi> {
  const total = await envoyer()
  while (aRefaire) {
    aRefaire = false
    const suite = await envoyer()
    total.envoyes += suite.envoyes
    total.refuses.push(...suite.refuses)
  }
  return total
}

export function envoyerPinsEnAttente(): Promise<Envoi> {
  if (enCours) {
    aRefaire = true
    return enCours
  }
  enCours = passes().finally(() => {
    enCours = null
    aRefaire = false
  })
  return enCours
}
