/**
 * QUOI     — le bas du profil : Lieux ajoutés, Envie d'y aller (maquette « COMPTE — sous le
 *            signe de l'Hoplite », 27/09), puis le Passeport (à la place de Visités, spec
 *            2026-10-07 ; en dernier, Uriel 07/10).
 * POURQUOI — les listes arrivent prêtes de la base : un ajout sur place est aussi visité
 *            (migration 426), Envie d'y aller exclut les deux.
 *            `envies === null` : l'Explorateur les masque, la section n'existe pas. Une section
 *            vide ne s'affiche pas non plus. Chaque section tient sur une ligne qui défile.
 */
import type { Lieu, ExplorateurProfile } from '../api/lireProfil'
import { useGlisser } from '@/shared/hooks/useGlisser'
import { useMaPosition } from '@/shared/hooks/useMaPosition'
import type { Point } from '@/shared/lib/distance'
import { LieuCarte } from '@/shared/ui/LieuCarte'
import { PasseportProfil } from './PasseportProfil'
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
      {profil.envies && (
        <Section titre="Envie d’y aller" lieux={profil.envies} position={position} avecAuteur />
      )}
      {profil.nbVisites > 0 && <PasseportProfil id={profil.id} />}
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
