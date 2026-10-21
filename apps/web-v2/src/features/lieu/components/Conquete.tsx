/**
 * QUOI     — « Conquis ! » : l'étendard tombe et se fiche dans le sol, l'écran tressaille, l'encre
 *            s'élargit au pied ; le mot est frappé à l'impact, puis le lieu, à qui on l'a pris, le nom
 *            qui flotte, le rang et l'enjeu.
 * POURQUOI — spec « Revendiquer par GPS » (Uriel, 21/10 : « qu'on ressente qu'on vient de CONQUÉRIR
 *            un lieu ») ; durées et courbes de la maquette animée 678:1676. Le bruitage part plus tôt,
 *            au toucher de « Planter mon étendard » : son coup sourd tombe ici, à l'impact.
 * ATTENTION — mouvement réduit : rien ne bouge, tout est déjà à sa place, pas de vibration.
 */
import { useEffect } from 'react'
import croix from '@/assets/ui/croix.svg'
import type { Conquete as ConqueteFaite } from '../api/lireLieu'
import styles from './Conquete.module.css'

const IMPACT_MS = 450

const mouvementReduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const phraseRang = (rang: number) =>
  rang === 1 ? 'Ton 1ᵉʳ lieu conquis' : `Ton ${String(rang)}ᵉ lieu conquis`

export function Conquete({
  lieu,
  conquete: { nom, prisA, rang },
  onVoirLeLieu,
  onFermer,
}: {
  lieu: string
  conquete: ConqueteFaite
  onVoirLeLieu: () => void
  onFermer: () => void
}) {
  // Le téléphone vibre quand la pointe touche le sol.
  useEffect(() => {
    if (mouvementReduit()) return
    const minuteur = setTimeout(() => {
      if ('vibrate' in navigator) navigator.vibrate(40)
    }, IMPACT_MS)
    return () => {
      clearTimeout(minuteur)
    }
  }, [])

  return (
    <div className={styles.conquete}>
      <button type="button" className={styles.fermer} aria-label="Fermer" onClick={onFermer}>
        <img src={croix} alt="" width={24} height={24} />
      </button>

      <div className={styles.scene} aria-hidden="true">
        <span className={styles.ombre} />
        <span className={styles.anneau} />
        <span className={styles.anneau} />
        <span className={styles.etendard} />
      </div>

      <div className={styles.texte}>
        <h2 className={styles.titre}>CONQUIS !</h2>
        <p className={styles.lieu}>{lieu}</p>
        {prisA && <p className={styles.pris}>PRIS À {prisA.toLocaleUpperCase('fr')}</p>}
        <p className={styles.phrase}>
          <strong>« {nom} »</strong> flotte sur ce lieu, jusqu’à ce qu’un autre vienne le reprendre.
        </p>
        <p className={styles.rang}>{phraseRang(rang)}</p>
        <p className={styles.enjeu}>On te préviendra si quelqu’un vient te le reprendre.</p>
      </div>

      <button type="button" className={styles.voir} onClick={onVoirLeLieu}>
        VOIR LE LIEU →
      </button>
    </div>
  )
}
