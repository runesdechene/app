/**
 * QUOI     — « Une version » (maquette 379:417) : qui, quand, son mot ; pour chaque texte changé (récit,
 *            rubriques), l'ajouté souligné et le retiré barré — sans texte changé (le nom, la nature,
 *            l'époque), la phrase de l'histoire, « a changé le nom » ; « Revenir à cette version ».
 * POURQUOI — voir ce que chacun a ajouté (Uriel, 05/10). Revenir crée une version de plus : rien ne se
 *            perd. La version vit dans la feuille de l'histoire : un moment, pas une adresse.
 */
import { useEffect, useRef } from 'react'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import type { ChampEcrit, Version, VersionDetail } from '../api/lireLieu'
import { useVersion } from '../hooks/useVersion'
import { ecart } from '../lib/ecart'
import { ceQuiAChange } from '../lib/versions'
import styles from './FeuilleVersion.module.css'

const LE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const TITRES: Record<ChampEcrit, string> = {
  recit: 'Le récit',
  acces: 'Accès',
  quand: 'Quand y aller',
  bon_a_savoir: 'Bon à savoir',
}

export function FeuilleVersionContenu({
  version,
  resume,
  actuelle,
  enCours,
  onRevenir,
}: {
  version: VersionDetail
  resume: string
  actuelle: boolean
  enCours: boolean
  onRevenir: () => void
}) {
  return (
    <div className={styles.version}>
      <p className={styles.qui}>
        <Avatar url={version.qui?.avatar ?? null} nom={version.qui?.nom ?? '?'} taille="petit" />
        <span>
          <strong>{version.qui?.nom ?? 'Quelqu’un'}</strong>
          <span className={styles.quand}>
            {[LE.format(new Date(version.quand)), version.note && `« ${version.note} »`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      </p>
      {version.champs.length === 0 && (
        <p className={styles.texte}>{`${version.qui?.nom ?? 'Quelqu’un'} ${resume}.`}</p>
      )}
      {version.champs.map((c) => (
        <section key={c.champ}>
          <h3 className={styles.titre}>{TITRES[c.champ]}</h3>
          <p className={styles.texte}>
            {ecart(c.avant, c.apres).map((m, i) =>
              m.genre === 'ajoute' ? (
                <ins key={i}>{m.texte}</ins>
              ) : m.genre === 'retire' ? (
                <del key={i}>{m.texte}</del>
              ) : (
                <span key={i}>{m.texte}</span>
              ),
            )}
          </p>
        </section>
      ))}
      {version.champs.length > 0 && (
        <p className={styles.legende}>
          <ins>Souligné</ins> : ce qui a été ajouté. <del>Barré</del> : ce qui a été retiré.
        </p>
      )}
      {!actuelle && (
        <>
          <Button kind="secondaire" disabled={enCours} onClick={onRevenir}>
            Revenir à cette version
          </Button>
          <p className={styles.legende}>Revenir crée une nouvelle version : rien ne se perd.</p>
        </>
      )}
    </div>
  )
}

// La version touchée dans l'histoire (sa ligne dit ce qu'elle a changé) : chargée, puis montrée ;
// « ‹ L'histoire » ramène à la liste. Le focus va à ce bouton : la ligne touchée a disparu.
export function VersionChoisie({
  id,
  ligne,
  actuelle,
  enCours,
  onRevenir,
  onRetour,
}: {
  id: number
  ligne: Version
  actuelle: boolean
  enCours: boolean
  onRevenir: () => void
  onRetour: () => void
}) {
  const { version, erreur } = useVersion(id)
  const retour = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    retour.current?.focus()
  }, [])
  return (
    <>
      <button ref={retour} type="button" className={styles.retour} onClick={onRetour}>
        ‹ L’histoire
      </button>
      {erreur ? (
        <p className={styles.legende}>
          La version n’a pas pu être chargée. Réessaie dans un instant.
        </p>
      ) : version === null ? (
        <p className={styles.legende}>Cette version n’existe plus.</p>
      ) : version === undefined ? (
        <div aria-busy="true" />
      ) : (
        <FeuilleVersionContenu
          version={version}
          resume={ceQuiAChange(ligne)}
          actuelle={actuelle}
          enCours={enCours}
          onRevenir={onRevenir}
        />
      )}
    </>
  )
}
