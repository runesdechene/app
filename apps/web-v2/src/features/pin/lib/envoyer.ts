/**
 * QUOI     — envoyer au serveur les pins posés dans le téléphone.
 * POURQUOI — un pin naît hors ligne (pinsEnAttente) ; il part au lancement, au retour du réseau et
 *            à l'ouverture du « + » (hooks/usePins). Le lieu-dit se cherche maintenant, faute de
 *            réseau à la pose ; sans réponse du géocodeur, le pin part sans.
 * ATTENTION — seuls les refus propres de `poser_pin` sont définitifs : 22023 (position ou date
 *            impossibles) et P0001 (GPS trop imprécis). Le pin reste alors dans le téléphone et
 *            l'écran le signale, il n'est jamais jeté en silence. Tout autre échec (coupure,
 *            jeton expiré PGRST301, connexion requise 42501, panne serveur) arrête l'envoi sans
 *            rien marquer : on réessaiera.
 *            Un seul envoi à la fois : les appels simultanés (lancement, retour du réseau, pose)
 *            partagent le même, sinon un pin partirait deux fois.
 */
import { endroitDe } from '@/shared/lib/adresse'
import { poserPin } from '../api/pins'
import { garderPinEnAttente, lirePinsEnAttente, retirerPinEnAttente } from './pinsEnAttente'

export type Envoi = { envoyes: number; refuses: string[] }

const REFUS_DE_POSER_PIN = ['22023', 'P0001']

function refusDuServeur(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && typeof e.code === 'string' && REFUS_DE_POSER_PIN.includes(e.code)
}

async function envoyer(): Promise<Envoi> {
  const envoi: Envoi = { envoyes: 0, refuses: [] }
  for (const p of await lirePinsEnAttente()) {
    if (p.refuse) continue
    const lieuDit = await endroitDe({ latitude: p.latitude, longitude: p.longitude })
      .then((e) => e.titre)
      .catch(() => null)
    try {
      await poserPin(p, lieuDit)
    } catch (e) {
      if (!refusDuServeur(e)) return envoi
      await garderPinEnAttente({ ...p, refuse: true })
      envoi.refuses.push(p.id)
      continue
    }
    await retirerPinEnAttente(p.id)
    envoi.envoyes += 1
  }
  return envoi
}

let enCours: Promise<Envoi> | null = null

export function envoyerPinsEnAttente(): Promise<Envoi> {
  enCours ??= envoyer().finally(() => {
    enCours = null
  })
  return enCours
}
