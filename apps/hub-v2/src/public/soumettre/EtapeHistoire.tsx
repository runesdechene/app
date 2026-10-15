/**
 * QUOI     — étape 3, « Ton histoire » : l'avis public, deux notes en étoiles, un mot privé pour
 *            l'équipe, le département. Tout est facultatif.
 * POURQUOI — l'avis et les notes nourrissent les avis de la boutique ; le mot privé ne sort jamais
 *            du Hub. Cliquer l'étoile déjà choisie retire la note.
 */
import { useState } from 'react'
import { EnTete, Navigation, BoutonSombre } from './Etape'
import { DEPARTEMENTS } from './lib/departements'
import type { Histoire } from './lib/formulaire'
import etape from './Etape.module.css'
import styles from './EtapeHistoire.module.css'

const LONGUEUR_MAX = 500

function Etoiles({ nom, note, noter }: { nom: string; note: number; noter: (n: number) => void }) {
  const [survol, setSurvol] = useState(0)
  return (
    <div className={styles.etoiles} role="group" aria-label={nom}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={styles.etoile}
          data-allumee={n <= (survol || note)}
          aria-label={`${String(n)} sur 5`}
          aria-pressed={n === note}
          onClick={() => {
            noter(n === note ? 0 : n)
          }}
          onMouseEnter={() => {
            setSurvol(n)
          }}
          onMouseLeave={() => {
            setSurvol(0)
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export function EtapeHistoire({
  histoire,
  changer,
  precedent,
  suivant,
}: {
  histoire: Histoire
  changer: (modif: Partial<Histoire>) => void
  precedent: () => void
  suivant: () => void
}) {
  const experience = 'Comment s’est passée ton expérience Runes de Chêne ?'
  const produits = 'Comment trouves-tu tes produits ?'
  return (
    <>
      <EnTete n={3} titre="Ton histoire" />

      <label className={etape.libelle} htmlFor="avis">
        Ton avis public (marque, expérience…) (optionnel)
      </label>
      <textarea
        id="avis"
        className={etape.champ}
        rows={4}
        maxLength={LONGUEUR_MAX}
        value={histoire.avis}
        placeholder="Ce que tu veux partager publiquement sur Runes de Chêne…"
        onChange={(e) => {
          changer({ avis: e.target.value })
        }}
      />

      <p className={etape.libelle}>{experience}</p>
      <Etoiles
        nom={experience}
        note={histoire.noteExperience}
        noter={(n) => {
          changer({ noteExperience: n })
        }}
      />

      <p className={etape.libelle}>{produits}</p>
      <Etoiles
        nom={produits}
        note={histoire.noteProduits}
        noter={(n) => {
          changer({ noteProduits: n })
        }}
      />

      <label className={etape.libelle} htmlFor="mot">
        Un mot pour l’équipe ? <span className={etape.discret}>(privé — ne sera jamais publié)</span>
      </label>
      <textarea
        id="mot"
        className={etape.champ}
        rows={3}
        maxLength={LONGUEUR_MAX}
        value={histoire.motEquipe}
        placeholder="Message privé à l’équipe Runes de Chêne…"
        onChange={(e) => {
          changer({ motEquipe: e.target.value })
        }}
      />

      <label className={etape.libelle} htmlFor="departement">
        Département (optionnel)
      </label>
      <select
        id="departement"
        className={etape.champ}
        value={histoire.departement}
        onChange={(e) => {
          changer({ departement: e.target.value })
        }}
      >
        <option value="">— Je préfère ne pas dire / hors France —</option>
        {DEPARTEMENTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <Navigation precedent={precedent}>
        <BoutonSombre onClick={suivant}>Suivant →</BoutonSombre>
      </Navigation>
    </>
  )
}
