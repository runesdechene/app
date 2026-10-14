/**
 * QUOI     — « La santé » : un point vert ou orange par service (spec §9).
 * ATTENTION — les commandes et les notifications viennent de la base, Synchro Shopify de la fonction
 *            Netlify, les fiches publiques de la date que note le workflow de la nuit. Une ligne
 *            n'apparaît qu'une fois sa réponse arrivée (jamais un vert par défaut). Reste au backlog :
 *            la version d'Explore (docs/tech-backlog.md, « Hub V2 — santé »).
 */
import sectionAjoutes from '@/assets/ui/section-ajoutes.svg'
import { depuis } from '@/shared/lib/quand'
import { Bloc } from '@/shared/ui/Bloc'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { Ouverture } from '../api/ouverture'
import type { useSanteBoutique } from '../hooks/useSanteBoutique'
import styles from './Ouverture.module.css'

const HEURE = 3600_000
const TROIS_JOURS = 72 * HEURE
const TRENTE_SIX_HEURES = 36 * HEURE

type Boutique = ReturnType<typeof useSanteBoutique>
type Ligne = { ok: boolean; titre: string; detail: string }

function ligneShopify({ shopify, shopifyErreur }: Boutique): Ligne[] {
  const titre = 'Synchro Shopify'
  if (shopifyErreur) return [{ ok: false, titre, detail: shopifyErreur }]
  if (!shopify) return []
  if (!shopify.ok) return [{ ok: false, titre, detail: shopify.erreur ?? 'Shopify ne répond pas' }]
  return [{ ok: true, titre, detail: `Boutique joignable · ${String(shopify.latence)} ms` }]
}

function ligneFiches(fiches: Boutique['fiches'], maintenant: Date): Ligne[] {
  const titre = 'Fiches publiques'
  if (fiches === undefined) return []
  if (fiches === null) return [{ ok: false, titre, detail: 'Jamais relevée' }]
  const ecoule = maintenant.getTime() - new Date(fiches).getTime()
  const ilYA = `il y a ${String(Math.round(ecoule / HEURE))} h`
  return ecoule < TRENTE_SIX_HEURES
    ? [{ ok: true, titre, detail: `Reconstruites ${ilYA}` }]
    : [{ ok: false, titre, detail: `Dernière reconstruction ${ilYA}` }]
}

export function Sante({ sante, boutique, maintenant }: { sante: Ouverture['sante']; boutique: Boutique; maintenant: Date }) {
  const commande = sante.derniere_commande
  const commandesOk = commande !== null && maintenant.getTime() - new Date(commande).getTime() < TROIS_JOURS
  const lignes: Ligne[] = [
    { ok: commandesOk, titre: 'Commandes Shopify', detail: commande ? `Dernière reçue ${depuis(commande, maintenant)}` : 'Aucune commande reçue' },
    ...ligneShopify(boutique),
    ...ligneFiches(boutique.fiches, maintenant),
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
