/**
 * QUOI     — le bas du profil : Lieux ajoutés, Visités, Envie d'y aller, en sections de cartes
 *            (maquette « COMPTE — sous le signe de l'Hoplite », 27/09).
 * POURQUOI — les listes arrivent exclusives de la base (Ajoutés > Visités > Envie d'y aller).
 *            `envies === null` : l'Explorateur les masque, la section n'existe pas. Une section
 *            vide ne s'affiche pas non plus. Chaque section tient sur une ligne qui défile.
 */
import type { Lieu, ExplorateurProfile } from '../api/lireProfil'
import { useGlisser } from '@/shared/hooks/useGlisser'
import { useMaPosition } from '@/shared/hooks/useMaPosition'
import type { Point } from '@/shared/lib/distance'
import { LieuCarte } from '@/shared/ui/LieuCarte'
import styles from './ProfilDecouvertes.module.css'

export function ProfilDecouvertes({ profil }: { profil: ExplorateurProfile }) {
  const position = useMaPosition()
  return (
    <>
      <Section
        titre="Lieux ajoutés"
        lieux={profil.ajoutes}
        position={position}
        avecAuteur={false}
      />
      <Section titre="Visités" lieux={profil.visites} position={position} avecAuteur />
      {profil.envies && (
        <Section titre="Envie d’y aller" lieux={profil.envies} position={position} avecAuteur />
      )}
    </>
  )
}

function Section({
  titre,
  lieux,
  position,
  avecAuteur,
}: {
  titre: string
  lieux: Lieu[]
  position: Point | null
  avecAuteur: boolean
}) {
  const glisser = useGlisser()
  if (lieux.length === 0) return null
  return (
    <section className={styles.section} aria-label={titre}>
      <h2 className={styles.titre}>
        {titre} <span className={styles.nombre}>{lieux.length}</span>
      </h2>
      {/* Carrousel : cadre flex > rangée flex: 1 qui défile (règle de interface.md). */}
      <div className={styles.cadre}>
        <ul ref={glisser} className={styles.rangee}>
          {lieux.map((l) => (
            <LieuCarte key={l.id} lieu={l} position={position} avecAuteur={avecAuteur} />
          ))}
        </ul>
      </div>
    </section>
  )
}
