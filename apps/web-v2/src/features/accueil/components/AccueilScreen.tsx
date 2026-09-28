/**
 * QUOI     — l'onglet Accueil (maquette 27:2, spec V2 §5) : Nouvelles de la marque, Ajoutés
 *            récemment, Sur les chemins.
 * POURQUOI — « L'Accueil, on le lit » : il se nourrit presque seul de ce que fait la communauté.
 *            La nouveauté mène à la boutique ; un lieu ouvre sa fiche dans l'Accueil, et la
 *            fiche sait que l'Accueil est derrière elle. Un bloc vide ne s'affiche pas.
 */
import { useRef } from 'react'
import sectionAjoutes from '@/assets/ui/section-ajoutes.svg'
import sectionNouvelles from '@/assets/ui/section-nouvelles.png'
import { useGlisser } from '@/shared/hooks/useGlisser'
import { useMaPosition } from '@/shared/hooks/useMaPosition'
import { LieuCarte } from '@/shared/ui/LieuCarte'
import { useAjoutes, useNouveaute } from '../hooks/useAccueil'
import styles from './AccueilScreen.module.css'
import { SurLesChemins } from './SurLesChemins'

export function AccueilScreen() {
  return (
    <div className={styles.accueil}>
      <Nouveaute />
      <Ajoutes />
      <SurLesChemins />
    </div>
  )
}

function Nouveaute() {
  const nouveaute = useNouveaute()
  if (!nouveaute) return null
  const contenu = (
    <>
      {nouveaute.image && <img className={styles.image} src={nouveaute.image} alt="" />}
      <span className={styles.titreNouveaute}>{nouveaute.titre}</span>
    </>
  )
  return (
    <section className={styles.section} aria-label="Nouvelles de la marque">
      <h2 className={styles.rubrique}>
        <img className={styles.icone} src={sectionNouvelles} alt="" />
        Nouvelles de la marque
      </h2>
      {nouveaute.lien ? (
        <a className={styles.nouveaute} href={nouveaute.lien} target="_blank" rel="noreferrer">
          {contenu}
        </a>
      ) : (
        <div className={styles.nouveaute}>{contenu}</div>
      )}
    </section>
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
