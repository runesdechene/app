/**
 * QUOI     — la dernière étape, « Toi » : prénom, e-mail, puis l'envoi. Avec photos, s'y ajoutent la
 *            taille, un mot privé pour l'équipe et le département, facultatifs, et les deux accords.
 * POURQUOI — avec photos, l'e-mail retrouve le compte du joueur, ou en crée un (deuxième accord) ; un
 *            avis seul ne crée pas de compte, il dit seulement « client vérifié » par l'e-mail. Le bouton
 *            reste inactif tant qu'un champ obligatoire manque. Une erreur d'envoi s'affiche ici, le
 *            formulaire intact, pour réessayer d'un geste.
 */
import { CaseACocher } from '../briques/CaseACocher'
import { MessageDErreur } from '../briques/MessageDErreur'
import { BoutonSombre, EnTete, Navigation } from './Etape'
import { DEPARTEMENTS } from './lib/departements'
import { toiComplet, type Histoire, type Toi } from './lib/formulaire'
import etape from './Etape.module.css'
import styles from './EtapeToi.module.css'

const LONGUEUR_MAX = 500

export function EtapeToi({
  avecPhotos,
  toi,
  changer,
  histoire,
  changerHistoire,
  erreur,
  precedent,
  envoyer,
}: {
  avecPhotos: boolean
  toi: Toi
  changer: (modif: Partial<Toi>) => void
  histoire: Histoire
  changerHistoire: (modif: Partial<Histoire>) => void
  erreur: string | null
  precedent: () => void
  envoyer: () => void
}) {
  return (
    <>
      <EnTete surTitre="Étape 4 sur 4" titre="Toi" />

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

      {avecPhotos && (
        <>
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
              changerHistoire({ motEquipe: e.target.value })
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
              changerHistoire({ departement: e.target.value })
            }}
          >
            <option value="">— Je préfère ne pas dire / hors France —</option>
            {DEPARTEMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

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
        </>
      )}

      {erreur && (
        <div className={styles.erreur}>
          <MessageDErreur>{erreur}</MessageDErreur>
        </div>
      )}

      <Navigation precedent={precedent}>
        <BoutonSombre envoi disabled={!toiComplet(toi, avecPhotos)} onClick={envoyer}>
          {avecPhotos ? 'Envoyer mes contenus ✦' : 'Publier mon avis ✦'}
        </BoutonSombre>
      </Navigation>
    </>
  )
}
