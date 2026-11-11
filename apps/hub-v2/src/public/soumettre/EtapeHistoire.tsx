/**
 * QUOI     — étape 3, « Ton histoire » : le vêtement, l'avis public, deux notes en étoiles, un mot
 *            privé pour l'équipe, le département. Tout est facultatif.
 * POURQUOI — l'avis, les notes et le vêtement nourrissent les avis de la boutique, rangés par type de
 *            vêtement ; le mot privé ne sort jamais du Hub.
 */
import { ChoixDuVetement } from './ChoixDuVetement'
import { EnTete, Navigation, BoutonSombre } from './Etape'
import { Etoiles } from './Etoiles'
import { DEPARTEMENTS } from './lib/departements'
import type { Histoire } from './lib/formulaire'
import etape from './Etape.module.css'

const LONGUEUR_MAX = 500

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
  const produits = 'La qualité du produit'
  const experience = 'Ton expérience avec Runes de Chêne'
  return (
    <>
      <EnTete surTitre="Étape 3 sur 4" titre="Ton histoire" />

      <ChoixDuVetement
        vetement={histoire.vetement}
        choisir={(cle) => {
          changer({ vetement: cle })
        }}
      />

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

      <p className={etape.libelle}>{produits}</p>
      <Etoiles
        nom={produits}
        note={histoire.noteProduits}
        noter={(n) => {
          changer({ noteProduits: n })
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
