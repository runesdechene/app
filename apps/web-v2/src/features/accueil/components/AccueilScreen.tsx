/**
 * QUOI     — l'onglet Accueil (maquette 27:2, spec V2 §5) : la bannière de la boutique, Ajoutés
 *            récemment, Sur les chemins.
 * POURQUOI — « L'Accueil, on le lit » : il se nourrit presque seul de ce que fait la communauté.
 *            Un lieu ouvre sa fiche dans l'Accueil, et la fiche sait que l'Accueil est derrière
 *            elle. Un bloc vide ne s'affiche pas. En tête, une bannière de la boutique a remplacé
 *            « Nouvelles de la marque » (Uriel, 28/09 : les annonces du Hub ne sont pas à jour).
 */
import { useRef } from 'react'
import sectionAjoutes from '@/assets/ui/section-ajoutes.svg'
import { useGlisser } from '@/shared/hooks/useGlisser'
import { useMaPosition } from '@/shared/hooks/useMaPosition'
import { LieuCarte } from '@/shared/ui/LieuCarte'
import { useAjoutes } from '../hooks/useAccueil'
import styles from './AccueilScreen.module.css'
import { Banniere } from './Banniere'
import { SurLesChemins } from './SurLesChemins'

export function AccueilScreen() {
  return (
    <div className={styles.accueil}>
      <Banniere />
      <Ajoutes />
      <SurLesChemins />
    </div>
  )
}

function Ajoutes() {
  const lieux = useAjoutes()
  const position = useMaPosition()
  const rangee = useRef<HTMLUListElement>(null)
  useGlisser(rangee)
  if (lieux.length === 0) return null
  return (
    <section className={styles.section} aria-label="Ajoutés récemment">
      <h2 className={styles.rubrique}>
        <img className={styles.icone} src={sectionAjoutes} alt="" />
        Ajoutés récemment
      </h2>
      {/* Carrousel : cadre flex > rangée flex: 1 qui défile (règle de interface.md). */}
      <div className={styles.cadre}>
        <ul ref={rangee} className={styles.rangee}>
          {lieux.map((l) => (
            <LieuCarte key={l.id} lieu={l} position={position} avecAuteur />
          ))}
        </ul>
      </div>
    </section>
  )
}
