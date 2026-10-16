/**
 * QUOI     — étape 4, « Toi » : prénom, e-mail, taille facultative, les deux accords, puis l'envoi.
 * POURQUOI — l'e-mail retrouve le compte du joueur, ou en crée un (deuxième accord) ; le bouton
 *            reste inactif tant qu'un champ obligatoire manque. Une erreur d'envoi s'affiche ici, le
 *            formulaire intact, pour réessayer d'un geste.
 */
import { CaseACocher } from '../briques/CaseACocher'
import { MessageDErreur } from '../briques/MessageDErreur'
import { BoutonSombre, EnTete, Navigation } from './Etape'
import { toiComplet, type Toi } from './lib/formulaire'
import etape from './Etape.module.css'
import styles from './EtapeToi.module.css'

export function EtapeToi({
  toi,
  changer,
  erreur,
  precedent,
  envoyer,
}: {
  toi: Toi
  changer: (modif: Partial<Toi>) => void
  erreur: string | null
  precedent: () => void
  envoyer: () => void
}) {
  return (
    <>
      <EnTete n={4} titre="Toi" />

      <label className={etape.libelle} htmlFor="prenom">
        Prénom *
      </label>
      <input
        id="prenom"
        className={etape.champ}
        autoComplete="given-name"
        placeholder="Ton prénom"
        value={toi.prenom}
        onChange={(e) => {
          changer({ prenom: e.target.value })
        }}
      />

      <label className={etape.libelle} htmlFor="email">
        E-mail *
      </label>
      <input
        id="email"
        className={etape.champ}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="toi@email.com"
        value={toi.email}
        onChange={(e) => {
          changer({ email: e.target.value })
        }}
      />

      <label className={etape.libelle} htmlFor="taille">
        Ta taille (optionnel)
      </label>
      <input
        id="taille"
        className={etape.champ}
        type="number"
        inputMode="numeric"
        min={100}
        max={250}
        placeholder="ex. 178 (en cm)"
        value={toi.tailleCm}
        onChange={(e) => {
          changer({ tailleCm: e.target.value })
        }}
      />
      <p className={etape.aide}>Si ta photo est retenue sur une fiche produit, ça aide les autres à choisir leur taille.</p>

      <div className={styles.accords}>
        <CaseACocher
          checked={toi.accordMarque}
          onChange={(e) => {
            changer({ accordMarque: e.target.checked })
          }}
        >
          J’accepte que mes contenus soient diffusés par la marque ou ses réseaux. *
        </CaseACocher>
        <CaseACocher
          checked={toi.accordCompte}
          onChange={(e) => {
            changer({ accordCompte: e.target.checked })
          }}
        >
          J’accepte la création de mon compte Runes de Chêne (accès à l’application). *
        </CaseACocher>
      </div>

      {erreur && (
        <div className={styles.erreur}>
          <MessageDErreur>{erreur}</MessageDErreur>
        </div>
      )}

      <Navigation precedent={precedent}>
        <BoutonSombre envoi disabled={!toiComplet(toi)} onClick={envoyer}>
          Envoyer mes contenus ✦
        </BoutonSombre>
      </Navigation>
    </>
  )
}
