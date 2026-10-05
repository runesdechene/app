/**
 * QUOI     — la feuille « L'histoire de la fiche » (maquettes 304:146, 379:324) : chaque version, qui et
 *            quand, ce qu'elle a changé ; la plus récente est « Actuelle ». Toucher une version la
 *            montre (ce qu'elle a ajouté et retiré, 05/10), et l'on peut y revenir.
 * POURQUOI — Modifier est ouvert à tous : l'histoire le rend sûr. Revenir à une version en crée
 *            une nouvelle, rien ne se perd.
 */
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/shared/ui/Avatar'
import { Feuille } from '@/shared/ui/Feuille'
import type { Version } from '../api/lireLieu'
import { useHistoire } from '../hooks/useHistoire'
import { ceQuiAChange } from '../lib/versions'
import { VersionChoisie } from './FeuilleVersion'
import styles from './Feuilles.module.css'

const LE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export function FeuilleHistoire({ id, onFermer }: { id: string; onFermer: () => void }) {
  const { versions, revenir, enCours, echec } = useHistoire(id)
  const [choisie, setChoisie] = useState<{ id: number; ligne: Version } | null>(null)
  // De retour à la liste, le focus revient à la ligne de la dernière version vue.
  const [vue, setVue] = useState<number | null>(null)
  const ligneVue = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (choisie === null) ligneVue.current?.focus()
  }, [choisie])
  return (
    <Feuille titre="L’histoire de la fiche" onFermer={onFermer}>
      <h2 className={styles.titre}>L’histoire de la fiche</h2>
      {choisie !== null ? (
        <VersionChoisie
          id={choisie.id}
          ligne={choisie.ligne}
          actuelle={choisie.id === versions?.[0]?.id}
          enCours={enCours}
          onRevenir={() => {
            revenir(choisie.id)
            setChoisie(null)
          }}
          onRetour={() => {
            setChoisie(null)
          }}
        />
      ) : (
        <>
          <ul className={styles.gens}>
            {versions?.map((v, i) => {
              const ligne = (
                <>
                  <Avatar url={v.qui?.avatar ?? null} nom={v.qui?.nom ?? '?'} taille="petit" />
                  <span className={styles.texte}>
                    <span className={styles.nom}>
                      <strong>{v.qui?.nom ?? 'Quelqu’un'}</strong> {ceQuiAChange(v)}
                    </span>
                    <span className={styles.description}>
                      {[LE.format(new Date(v.quand)), v.note].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {i === 0 ? (
                    <span className={styles.actuelle}>Actuelle</span>
                  ) : (
                    v.id !== null && <span className={styles.voir}>Voir ›</span>
                  )}
                </>
              )
              const versionId = v.id
              return (
                <li key={versionId ?? 'origine'}>
                  {versionId === null ? (
                    <div className={styles.personne}>{ligne}</div>
                  ) : (
                    <button
                      ref={versionId === vue ? ligneVue : undefined}
                      type="button"
                      className={styles.version}
                      onClick={() => {
                        setVue(versionId)
                        setChoisie({ id: versionId, ligne: v })
                      }}
                    >
                      {ligne}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          {echec && (
            <p className={styles.refus} role="alert">
              Pas de retour possible pour l’instant. Réessaie dans un instant.
            </p>
          )}
          <p className={styles.description}>
            Toucher une version montre ce qu’elle a ajouté et retiré. Chaque version est gardée :
            rien ne se perd.
          </p>
        </>
      )}
    </Feuille>
  )
}
