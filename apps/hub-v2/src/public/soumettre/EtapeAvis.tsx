/**
 * QUOI     — étape 1 de l'avis seul, « Ton avis » : le vêtement, la qualité du textile, l'expérience,
 *            quelques mots (maquette Figma 644:1703).
 * POURQUOI — 30 secondes, sans photo. « Suivant » attend un vêtement et une note ou un texte : sans
 *            vêtement, l'avis ne saurait pas sur quelle page aller.
 */
import { ChoixDuVetement } from './ChoixDuVetement'
import { BoutonSombre, EnTete, Navigation } from './Etape'
import { Etoiles } from './Etoiles'
import { avisComplet, VETEMENTS, type Histoire } from './lib/formulaire'
import etape from './Etape.module.css'

const LONGUEUR_MAX = 500

export function EtapeAvis({
  histoire,
  changer,
  suivant,
}: {
  histoire: Histoire
  changer: (modif: Partial<Histoire>) => void
  suivant: () => void
}) {
  const produits = 'La qualité du textile'
  const experience = 'Ton expérience avec Runes de Chêne'
  const page = VETEMENTS.find((v) => v.cle === histoire.vetement)?.page ?? 'la boutique'
  return (
    <>
      <EnTete surTitre="Étape 1 sur 2" titre="Ton avis">
        Comment s’est passée ta commande ?
      </EnTete>

      <ChoixDuVetement
        vetement={histoire.vetement}
        choisir={(cle) => {
          changer({ vetement: cle })
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

      <label className={etape.libelle} htmlFor="avis">
        Ton avis, en quelques mots
      </label>
      <textarea
        id="avis"
        className={etape.champ}
        rows={4}
        maxLength={LONGUEUR_MAX}
        value={histoire.avis}
        placeholder="Le tissu est épais et doux, le dessin n’a pas bougé après dix lavages. Livré vite, bien emballé."
        onChange={(e) => {
          changer({ avis: e.target.value })
        }}
      />
      <p className={etape.aide}>
        Publié sur {page} avec ton prénom et la date. Si ton e-mail correspond à un client Runes de Chêne, ton avis porte la
        mention « Client vérifié ».
      </p>

      <Navigation>
        <BoutonSombre disabled={!avisComplet(histoire)} onClick={suivant}>
          Suivant →
        </BoutonSombre>
      </Navigation>
    </>
  )
}
