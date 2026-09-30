/**
 * QUOI     — la barre de recherche de la vitrine et ses résultats, juste dessous : la vignette,
 *            le nom, la nature et la région. Un résultat ouvre l'aperçu du lieu.
 * POURQUOI — Uriel, 30/09 : « digne d'un moteur de recherche », et ouverte à qui n'a pas de
 *            compte. Au-delà des premiers lieux, l'invitation à rejoindre : la carte entière
 *            est derrière le compte. Une nature choisie se pose dans la barre, en étiquette à sa
 *            couleur et à son icône (comme sur la fiche d'un lieu), qu'une croix retire.
 * ATTENTION — les résultats ne se montrent que tant que la recherche a le focus (CSS
 *            :focus-within) : toucher ailleurs ou Échap les range, sans code d'ouverture.
 */
import type { Ref } from 'react'
import { Link } from 'react-router'
import type { Nature } from '../api/lireVitrine'
import { useRecherche } from '../hooks/useVitrine'
import styles from './Recherche.module.css'

const NOMBRE = new Intl.NumberFormat('fr-FR')

export function Recherche({
  texte,
  nature,
  onTexte,
  onRetirerNature,
  ref,
}: {
  texte: string
  nature: Nature | null
  onTexte: (texte: string) => void
  onRetirerNature: () => void
  ref: Ref<HTMLInputElement>
}) {
  const resultats = useRecherche(texte, nature?.id ?? null)
  const autres = resultats ? resultats.total - resultats.lieux.length : 0

  return (
    <search className={styles.recherche}>
      <div className={styles.barre}>
        <span className={styles.loupe} aria-hidden="true" />
        {nature && (
          <button
            type="button"
            className={styles.etiquette}
            style={nature.couleur ? { '--type': nature.couleur } : undefined}
            aria-label={`Retirer ${nature.nom}`}
            onClick={onRetirerNature}
          >
            {nature.icone && (
              <span
                className={styles.icone}
                style={{ '--icone': `url(${nature.icone})` }}
                aria-hidden="true"
              />
            )}
            {nature.nom}
            <span className={styles.croix} aria-hidden="true" />
          </button>
        )}
        <input
          ref={ref}
          className={styles.champ}
          type="search"
          value={texte}
          placeholder="Un dolmen, un château, une forêt…"
          aria-label="Chercher un lieu"
          onChange={(e) => {
            onTexte(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.currentTarget.blur()
          }}
        />
      </div>

      {resultats && (
        <div className={styles.resultats}>
          {resultats.lieux.length === 0 ? (
            <p className={styles.vide}>Aucun lieu ne porte ce nom. Essaie un autre mot.</p>
          ) : (
            <ul className={styles.liste}>
              {resultats.lieux.map((l) => (
                <li key={l.id}>
                  <Link className={styles.lieu} to={`/bienvenue/lieu/${l.id}`}>
                    {l.vignette ? (
                      <img className={styles.vignette} src={l.vignette} alt="" loading="lazy" />
                    ) : (
                      <span className={styles.vignette} aria-hidden="true" />
                    )}
                    <span className={styles.nom}>{l.nom}</span>
                    <span className={styles.detail}>
                      {[l.nature?.nom, l.region].filter(Boolean).join(' · ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {autres > 0 && (
            <Link className={styles.autres} to="/bienvenue/preambule">
              Et {NOMBRE.format(autres)} autres lieux, sur la carte des Explorateurs
            </Link>
          )}
        </div>
      )}
    </search>
  )
}
