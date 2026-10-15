/**
 * QUOI     — la carte de fin : « Bienvenue dans le Mouvement ! », les Couronnes de bienvenue d'un
 *            nouveau compte, le lien vers l'appli.
 * POURQUOI — les Couronnes de bienvenue (réglage `ugc_welcome_crowns`) sont en pause mais
 *            reviendront en bonus : la carte les montre dès que le réglage dépasse zéro. Si des
 *            fichiers sont restés en route, le joueur le sait.
 */
import drapeau from '@/assets/ui/drapeau.svg'
import type { Reussite } from './useEnvoi'
import styles from './Succes.module.css'

const APPLI = 'https://app.runesdechene.com'

export function Succes({ reussite, couronnes }: { reussite: Reussite; couronnes: number }) {
  const { nouveauCompte, partis, total } = reussite
  return (
    <div className={styles.carte}>
      <img className={styles.drapeau} src={drapeau} alt="" />
      <h2 className={styles.titre}>Bienvenue dans le Mouvement !</h2>
      <p className={styles.texte}>
        Tes contenus partent en validation. Dès qu’ils sont adoubés, tes Couronnes de Chêne atterrissent sur ton compte — on te
        prévient par e-mail.
      </p>
      {partis < total && (
        <p className={styles.texte}>
          Envoyés : {partis} sur {total}. Les autres n’ont pas pu partir.
        </p>
      )}
      {nouveauCompte && couronnes > 0 && (
        <div className={styles.cadeau}>
          <span className={styles.cadeauLibelle}>Cadeau de bienvenue</span>
          <span className={styles.cadeauMontant}>+{couronnes} Couronnes</span>
        </div>
      )}
      <a className={styles.appli} href={APPLI} target="_blank" rel="noopener noreferrer">
        Ouvrir l’application →
      </a>
    </div>
  )
}
