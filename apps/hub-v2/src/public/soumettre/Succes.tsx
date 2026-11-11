/**
 * QUOI     — la carte de fin : « Bienvenue dans le Mouvement ! », les Couronnes de bienvenue d'un
 *            nouveau compte, le lien vers l'appli ; pour un avis sans photo, « Merci pour ton avis ! ».
 * POURQUOI — les Couronnes de bienvenue (réglage `ugc_welcome_crowns`) sont en pause mais
 *            reviendront en bonus : la carte les montre dès que le réglage dépasse zéro. Si des
 *            fichiers sont restés en route, le joueur sait lesquels.
 */
import drapeau from '@/assets/ui/drapeau.svg'
import type { Reussite } from './useEnvoi'
import styles from './Succes.module.css'

const APPLI = 'https://app.runesdechene.com'

export function Succes({ reussite, couronnes, avisSeul }: { reussite: Reussite; couronnes: number; avisSeul: boolean }) {
  const { nouveauCompte, echecs } = reussite
  if (avisSeul) {
    return (
      <div className={styles.carte}>
        <img className={styles.drapeau} src={drapeau} alt="" />
        <h2 className={styles.titre}>Merci pour ton avis !</h2>
        <p className={styles.texte}>Il part en validation. Une fois relu, il rejoint la boutique.</p>
        <a className={styles.appli} href={APPLI} target="_blank" rel="noopener noreferrer">
          Ouvrir l’application →
        </a>
      </div>
    )
  }
  return (
    <div className={styles.carte}>
      <img className={styles.drapeau} src={drapeau} alt="" />
      <h2 className={styles.titre}>Bienvenue dans le Mouvement !</h2>
      <p className={styles.texte}>
        Tes contenus partent en validation. Dès qu’ils sont adoubés, tes Couronnes de Chêne atterrissent sur ton compte — on te
        prévient par e-mail.
      </p>
      {echecs.length > 0 && (
        <p className={styles.texte}>
          {echecs.length > 1 ? 'Pas partis' : 'Pas parti'} : {echecs.join(', ')}
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
