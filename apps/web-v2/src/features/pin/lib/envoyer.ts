/**
 * QUOI     — envoyer au serveur les pins posés dans le téléphone.
 * POURQUOI — un pin naît hors ligne (pinsEnAttente) ; il part au lancement, au retour du réseau et
 *            à l'ouverture du « + » (hooks/usePins). Le lieu-dit se cherche maintenant, faute de
 *            réseau à la pose ; sans réponse du géocodeur, le pin part sans.
 * ATTENTION — une erreur réseau arrête l'envoi (on réessaiera) ; un refus du serveur (code
 *            Postgres : précision, date, position) est définitif : le pin reste dans le téléphone
 *            et l'écran le signale, il n'est jamais jeté en silence.
 */
import { endroitDe } from '@/shared/lib/adresse'
import { poserPin } from '../api/pins'
import { garderPinEnAttente, lirePinsEnAttente, retirerPinEnAttente } from './pinsEnAttente'

export type Envoi = { envoyes: number; refuses: string[] }

// Une erreur PostgREST porte un code Postgres ; une coupure réseau, non.
function refusDuServeur(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && typeof e.code === 'string' && e.code !== ''
}

export async function envoyerPinsEnAttente(): Promise<Envoi> {
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
