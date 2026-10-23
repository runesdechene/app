/**
 * QUOI     — un choix dans une longue liste groupée (le modèle d'une Missive, maquette 756:2592) : fermé,
 *            l'option retenue avec sa vignette ; ouvert, une recherche, les groupes, l'option retenue cochée.
 * POURQUOI — un <select> natif ne montre ni vignette ni recherche, et les modèles seront nombreux
 *            (Uriel, 22/10). Le clavier suit le motif « listbox » : flèches, Entrée, Échap.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import styles from './Choix.module.css'

export type OptionDeChoix<T extends string> = {
  valeur: T
  libelle: string
  groupe: string
  detail?: string
  vignette?: ReactNode
}

// « Évènement » se trouve en tapant « evenement ».
const sansAccent = (texte: string) => texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function Choix<T extends string>({ valeur, options, onChange, recherche, libelleAccessible }: {
  valeur: T
  options: OptionDeChoix<T>[]
  onChange: (valeur: T) => void
  /** Le texte du champ de recherche ; sans lui, pas de recherche. */
  recherche?: string
  libelleAccessible: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const [filtre, setFiltre] = useState('')
  const [actif, setActif] = useState(0)
  const racine = useRef<HTMLDivElement>(null)
  const bouton = useRef<HTMLButtonElement>(null)
  const id = useId()

  const retenue = options.find((o) => o.valeur === valeur)
  const visibles = options.filter((o) => sansAccent(o.libelle).includes(sansAccent(filtre)))
  const groupes = [...new Set(visibles.map((o) => o.groupe))]

  // Un clic hors du choix le referme.
  useEffect(() => {
    if (!ouvert) return
    const dehors = (e: PointerEvent) => {
      if (e.target instanceof Node && !racine.current?.contains(e.target)) setOuvert(false)
    }
    document.addEventListener('pointerdown', dehors)
    return () => {
      document.removeEventListener('pointerdown', dehors)
    }
  }, [ouvert])

  function ouvrir() {
    setFiltre('')
    setActif(Math.max(0, options.findIndex((o) => o.valeur === valeur)))
    setOuvert(true)
  }

  function fermer() {
    setOuvert(false)
    bouton.current?.focus()
  }

  function choisir(option: OptionDeChoix<T>) {
    onChange(option.valeur)
    fermer()
  }

  function clavier(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const pas = e.key === 'ArrowDown' ? 1 : -1
      setActif((a) => (a + pas + visibles.length) % Math.max(visibles.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const option = visibles[actif]
      if (option) choisir(option)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      fermer()
    }
  }

  const optionActive = visibles[actif]
  const idActif = optionActive ? `${id}-${optionActive.valeur}` : undefined

  return (
    <div className={styles.choix} ref={racine}>
      <button
        ref={bouton}
        type="button"
        className={styles.ferme}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        onClick={() => {
          if (ouvert) setOuvert(false)
          else ouvrir()
        }}
      >
        <span className={styles.masque}>{libelleAccessible} : </span>
        {retenue?.vignette}
        <span className={styles.textes}>
          <span className={styles.libelle}>{retenue?.libelle}</span>
          {retenue?.detail && <span className={styles.detail}>{retenue.detail}</span>}
        </span>
        <span className={styles.fleche} aria-hidden="true">▾</span>
      </button>

      {ouvert && (
        <div className={styles.panneau} onKeyDown={clavier}>
          {recherche && (
            <input
              type="search"
              className={styles.recherche}
              aria-label="Chercher"
              placeholder={recherche}
              aria-controls={`${id}-liste`}
              aria-activedescendant={idActif}
              autoFocus
              value={filtre}
              onChange={(e) => {
                setFiltre(e.target.value)
                setActif(0)
              }}
            />
          )}
          <ul
            id={`${id}-liste`}
            role="listbox"
            aria-label={libelleAccessible}
            aria-activedescendant={idActif}
            tabIndex={recherche ? -1 : 0}
            autoFocus={!recherche}
            className={styles.liste}
          >
            {visibles.length === 0 && <li className={styles.vide}>Rien ne porte ce nom.</li>}
            {groupes.map((groupe) => (
              <li key={groupe} role="presentation">
                <ul role="group" aria-label={groupe} className={styles.groupe}>
                  <li role="presentation" aria-hidden="true" className={styles.nomDeGroupe}>
                    {groupe}
                  </li>
                  {visibles.map((option, i) =>
                    option.groupe !== groupe ? null : (
                      <li
                        key={option.valeur}
                        id={`${id}-${option.valeur}`}
                        role="option"
                        aria-selected={option.valeur === valeur}
                        data-actif={i === actif}
                        className={styles.option}
                        onPointerEnter={() => {
                          setActif(i)
                        }}
                        onClick={() => {
                          choisir(option)
                        }}
                      >
                        {option.vignette}
                        <span className={styles.textes}>
                          <span className={styles.libelle}>{option.libelle}</span>
                          {option.detail && <span className={styles.detail}>{option.detail}</span>}
                        </span>
                        {option.valeur === valeur && (
                          <span className={styles.coche} aria-hidden="true">
                            ✓
                          </span>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
