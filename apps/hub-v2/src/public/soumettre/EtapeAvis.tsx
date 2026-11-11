/**
 * QUOI     — étape 1 de l'avis seul, « Ton avis » : le vêtement, la qualité du produit, l'expérience,
 *            quelques mots (maquette Figma 644:1703), et le SAV en bas.
 * POURQUOI — 30 secondes, sans photo. « Suivant » attend un vêtement et une note ou un texte : sans
 *            vêtement, l'avis ne saurait pas sur quelle page aller. Un client qui a eu un souci doit
 *            trouver le SAV avant de laisser une mauvaise note.
 */
import { ChoixDuVetement } from './ChoixDuVetement'
import { BoutonSombre, EnTete, Navigation } from './Etape'
import { Etoiles } from './Etoiles'
import { avisComplet, VETEMENTS, type Histoire } from './lib/formulaire'
import etape from './Etape.module.css'

const LONGUEUR_MAX = 500
const SAV = 'contact@runesdechene.com'

export function EtapeAvis({
  histoire,
  changer,
  suivant,
}: {
  histoire: Histoire
  changer: (modif: Partial<Histoire>) => void
  suivant: () => void
}) {
  const produits = 'La qualité du produit'
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
        placeholder="Ce que tu as pensé de ton achat, de ton expérience auprès de notre boutique ou de notre stand…"
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

      <p className={etape.aide}>
        Il y a eu un souci ? Nous avons un SAV pour tous nos articles : écris-nous à{' '}
        <a href={`mailto:${SAV}`}>{SAV}</a>.
      </p>
    </>
  )
}
