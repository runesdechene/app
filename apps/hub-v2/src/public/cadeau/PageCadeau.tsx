/**
 * QUOI     — /flyercadeau, la page du QR cadeau : un e-mail contre un code promo boutique. La
 *            fonction `flyer-create-account` crée au passage le client Shopify et le compte de l'appli.
 * POURQUOI — le visiteur vient d'un flyer, sans compte : un champ, une case (décochée, la newsletter
 *            se demande), un bouton. Le bouton reste inactif tant que l'e-mail n'en est pas un.
 *            Maquette Figma 606:1435 / 606:1472 (téléphone), 606:1591 / 606:1615 (PC).
 */
import { useState, type SubmitEvent } from 'react'
import cadeau from '@/assets/flyer/cadeau.webp'
import { Bouton, LienBouton } from '../briques/Bouton'
import { CaseACocher } from '../briques/CaseACocher'
import { Champ } from '../briques/Champ'
import { MessageDErreur } from '../briques/MessageDErreur'
import { PhotoFlyer } from '../briques/PhotoFlyer'
import { PagePublique } from '../PagePublique'
import { demanderCadeau } from './api'
import styles from './PageCadeau.module.css'

const BOUTIQUE = 'https://runesdechene.com'
const DONNEES_PERSONNELLES = 'https://app.runesdechene.com/legal/confidentialite'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Titre({ surtitre, titre }: { surtitre: string; titre: string }) {
  return (
    <h1 className={styles.titre}>
      <span className={styles.surtitre}>{surtitre}</span> <span>{titre}</span>
    </h1>
  )
}

function LeCode({ code }: { code: string }) {
  const lien = `${BOUTIQUE}/discount/${encodeURIComponent(code)}`
  return (
    <div className={styles.etape}>
      <div className={styles.haut}>
        <Titre surtitre="Ton cadeau" titre="Code promo boutique" />
        <p className={styles.texte}>Utilise ce code à la boutique en ligne :</p>
        <div className={styles.code}>
          <strong className={styles.valeur}>{code}</strong>
          <span className={styles.lien}>{lien.replace('https://', '')}</span>
        </div>
      </div>
      <div className={styles.action}>
        <LienBouton href={lien}>J’en profite sur la boutique</LienBouton>
        <p className={styles.aBientot}>Garde-le précieusement. À bientôt, Compagnon !</p>
        <p className={styles.pied}>
          <a href={DONNEES_PERSONNELLES}>Données personnelles</a>
        </p>
      </div>
    </div>
  )
}

export function PageCadeau() {
  const [email, setEmail] = useState('')
  // La newsletter se demande, décochée (L34-5 CPCE) : le code promo ne l'impose pas.
  const [newsletter, setNewsletter] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)

  const adresse = email.trim().toLowerCase()
  const valide = EMAIL.test(adresse)

  async function envoyer(e: SubmitEvent) {
    e.preventDefault()
    if (!valide || envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      setCode((await demanderCadeau(adresse, newsletter)).code)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <PagePublique photo={<PhotoFlyer telephone={false} />}>
      <div className={styles.page}>
        <a href={BOUTIQUE} className={styles.retour}>
          ← Retourner sur la boutique
        </a>
        <img src={cadeau} alt="" className={styles.cadeau} />
        {code !== null ? (
          <LeCode code={code} />
        ) : (
          <form className={styles.etape} onSubmit={(e) => void envoyer(e)} noValidate>
            <div className={styles.haut}>
              <Titre surtitre="Pendant que le monde scrolle," titre="un mouvement s’éveille" />
              <p className={styles.texte}>
                Réponds à l’appel pour débloquer ton premier cadeau chez Runes de Chêne.
              </p>
              <div className={styles.saisie}>
                <Champ
                  libelle="Ton e-mail"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="ton@email.fr"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                  }}
                  disabled={envoi}
                />
                <CaseACocher
                  checked={newsletter}
                  onChange={(e) => {
                    setNewsletter(e.target.checked)
                  }}
                  disabled={envoi}
                >
                  Je veux recevoir les nouvelles de Runes de Chêne (nouveaux Fragments, ventes
                  privées). Désinscription en un clic.
                </CaseACocher>
                {erreur && <MessageDErreur>{erreur}</MessageDErreur>}
              </div>
            </div>
            <div className={styles.action}>
              <Bouton type="submit" disabled={!valide || envoi}>
                {envoi ? 'Un instant…' : 'Recevoir mon cadeau'}
              </Bouton>
              <p className={styles.pied}>
                Ton e-mail sert à t’envoyer ton code et, si tu as coché la case, nos nouvelles.{' '}
                <a href={DONNEES_PERSONNELLES}>Données personnelles</a>
              </p>
            </div>
          </form>
        )}
      </div>
    </PagePublique>
  )
}
