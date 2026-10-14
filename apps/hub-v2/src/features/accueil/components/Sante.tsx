/**
 * QUOI     — « La santé » : un point vert ou orange par service (spec §9).
 * ATTENTION — Synchro Shopify et fiches publiques arrivent avec le plan 4 (fonctions Netlify) ;
 *            ici, ce que la base sait : les commandes reçues, les notifications, la version d'Explore.
 */
import sectionAjoutes from '@/assets/ui/section-ajoutes.svg'
import { depuis } from '@/shared/lib/quand'
import { Bloc } from '@/shared/ui/Bloc'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { Ouverture } from '../api/ouverture'
import styles from './Ouverture.module.css'

const TROIS_JOURS = 3 * 24 * 3600_000

export function Sante({ sante, maintenant }: { sante: Ouverture['sante']; maintenant: Date }) {
  const commande = sante.derniere_commande
  const commandesOk = commande !== null && maintenant.getTime() - new Date(commande).getTime() < TROIS_JOURS
  const lignes = [
    { ok: commandesOk, titre: 'Commandes Shopify', detail: commande ? `Dernière reçue ${depuis(commande, maintenant)}` : 'Aucune commande reçue' },
    { ok: true, titre: 'Notifications', detail: `${String(sante.notifications)} envoyées sur la période · ${String(sante.notifications_lues)} lues` },
  ]
  return (
    <section className={styles.section}>
      <TitreDeSection titre="La santé" icone={sectionAjoutes} />
      <Bloc>
        {lignes.map((l) => (
          <div key={l.titre} className={styles.etat}>
            <span className={styles.point} data-ok={l.ok} />
            <span className={styles.etatTexte}>
              <span className={styles.etatTitre}>{l.titre}</span>
              <span className={styles.etatDetail}>{l.detail}</span>
            </span>
          </div>
        ))}
      </Bloc>
    </section>
  )
}
