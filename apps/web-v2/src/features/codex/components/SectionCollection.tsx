/**
 * QUOI     — une collection du Codex : son panneau teinté à sa couleur, son icône, son compte, sa
 *            barre, son titre à gagner (ou obtenu), et la grille de ses Fragments ; repliable.
 * POURQUOI — maquette F (02/11) : à 50 Fragments, une collection où l'on n'a rien reste repliée
 *            sur une ligne ; une petite (3 motifs ou moins) s'ouvre toujours. Porter toute la collection donne son titre.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { CarteFragment } from '@/shared/ui/CarteFragment'
import type { Collection } from '../api/lireCodex'
import { libelleEdition } from '@/shared/lib/edition'
import styles from './SectionCollection.module.css'

function phraseDuTitre(c: Collection): string | null {
  if (!c.titre) return null
  return c.portes === c.total
    ? `Titre obtenu : « ${c.titre} »`
    : `Porte les ${String(c.total)} pour gagner le titre « ${c.titre} »`
}

// Repliée, une petite collection ressemble à une case vide (Uriel, 05/11) : elle s'ouvre d'office.
const PETITE = 3

export function SectionCollection({ collection: c }: { collection: Collection }) {
  const [ouverte, setOuverte] = useState(
    c.total <= PETITE || c.fragments.some((f) => f.etat !== 'inconnu'),
  )
  const titre = phraseDuTitre(c)
  return (
    <section
      className={styles.collection}
      data-ouverte={ouverte || undefined}
      style={c.couleur ? { '--couleur-collection': c.couleur } : undefined}
      aria-label={c.nom}
    >
      <button
        type="button"
        className={styles.tete}
        aria-expanded={ouverte}
        onClick={() => {
          setOuverte(!ouverte)
        }}
      >
        {/* L'icône en pochoir, à la teinte de la collection (Uriel, 05/11). */}
        {c.icone && (
          <span
            className={styles.icone}
            style={{ '--icone': `url("${c.icone}")` }}
            aria-hidden="true"
          />
        )}
        <span className={styles.nom}>{c.nom}</span>
        <span className={styles.compte}>
          {c.portes} sur {c.total} {c.portes > 1 ? 'portés' : 'porté'}
        </span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      <div className={styles.barre} aria-hidden="true">
        <span style={{ '--part': `${String((c.portes / c.total) * 100)}%` }} />
      </div>
      <div className={styles.repli}>
        {/* Replié, le contenu n'est pas rendu : à 50 Fragments, rien ne se charge pour rien. */}
        {ouverte && (
          <div className={styles.contenu}>
            {titre && (
              <p className={styles.titre} data-obtenu={c.portes === c.total || undefined}>
                {titre}
              </p>
            )}
            <ul className={styles.grille}>
              {c.fragments.map((f) => {
                const carte = (
                  <CarteFragment
                    nom={f.nom}
                    image={f.illustration}
                    etat={f.etat}
                    scans={f.scans}
                    nouveau={f.nouveau}
                    edition={libelleEdition(f.edition, f.editionPrecision)}
                    couleur={c.couleur}
                  />
                )
                // Un Fragment inconnu reste une silhouette : on le découvre en le scannant.
                return (
                  <li key={f.id}>
                    {f.etat === 'inconnu' ? (
                      carte
                    ) : (
                      <Link className={styles.lien} to={`/codex/fragment/${String(f.id)}`}>
                        {carte}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
