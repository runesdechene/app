/**
 * QUOI     — la feuille « Partager ce lieu », ouverte en haut à droite de la photo (maquette
 *            236:128) : l'aperçu, « Copier le lien », « Partager ailleurs… ».
 * POURQUOI — on partage une phrase et la page publique du lieu (`/lieu/<slug>`, comme la V1) :
 *            celui qui la reçoit n'a besoin d'aucun compte. Sans page publique, l'adresse de la
 *            fiche. Le partage du téléphone existe déjà (`navigator.share`) : on l'ouvre, on ne le
 *            refait pas ; sans lui (un ordinateur), la ligne disparaît. « Envoyer à un
 *            Explorateur » arrive avec les Messages.
 */
import { useEffect, useState } from 'react'
import chevron from '@/assets/ui/chevron.svg'
import copier from '@/assets/ui/copier.svg'
import partager from '@/assets/ui/partager-encre.svg'
import { Feuille } from '@/shared/ui/Feuille'
import type { FicheLieu } from '../api/lireLieu'
import styles from './Feuilles.module.css'

const DUREE_COPIE = 2000
const PAGES_PUBLIQUES = 'https://app.runesdechene.com/lieu/'

export function FeuillePartager({
  fiche,
  onFermer,
}: {
  fiche: Pick<FicheLieu, 'id' | 'slug' | 'nom' | 'lat' | 'lng' | 'type' | 'photos'>
  onFermer: () => void
}) {
  const [copie, setCopie] = useState(false)
  const phrase = `J’ai trouvé ${fiche.nom} sur Runes de Chêne EXPLORE - tu connais ?`
  const lien = fiche.slug
    ? `${PAGES_PUBLIQUES}${fiche.slug}`
    : `${window.location.origin}${import.meta.env.BASE_URL}carte/lieu/${fiche.id}`
  const partageNatif = 'share' in navigator
  const vignette = fiche.photos[0]?.vignette

  useEffect(() => {
    if (!copie) return
    const minuteur = setTimeout(() => {
      setCopie(false)
    }, DUREE_COPIE)
    return () => {
      clearTimeout(minuteur)
    }
  }, [copie])

  return (
    <Feuille titre="Partager ce lieu" onFermer={onFermer}>
      <h2 className={styles.titre}>Partager ce lieu</h2>
      <div className={styles.apercu}>
        {vignette && <img className={styles.vignette} src={vignette} alt="" />}
        <span>
          <span className={styles.apercuNom}>{fiche.nom}</span>
          {fiche.type && <span className={styles.apercuType}>{fiche.type.nom}</span>}
        </span>
      </div>
      <button
        type="button"
        className={styles.choix}
        onClick={() => {
          void navigator.clipboard.writeText(`${phrase}\n${lien}`).then(() => {
            setCopie(true)
          })
        }}
      >
        <img className={styles.icone} src={copier} alt="" />
        <span className={styles.texte}>
          <span className={styles.nom}>Copier le lien</span>
          <span className={styles.description} aria-live="polite">
            {copie ? 'Lien copié' : 'Le lien ouvre la fiche, sur téléphone comme sur ordinateur.'}
          </span>
        </span>
        <img className={styles.chevron} src={chevron} alt="" />
      </button>
      {partageNatif && (
        <button
          type="button"
          className={styles.choix}
          onClick={() => {
            // Annuler le partage n'est pas une erreur : rien à dire.
            void navigator
              .share({ title: fiche.nom, text: phrase, url: lien })
              .catch(() => undefined)
          }}
        >
          <img className={styles.icone} src={partager} alt="" />
          <span className={styles.texte}>
            <span className={styles.nom}>Partager ailleurs…</span>
            <span className={styles.description}>
              WhatsApp, SMS, Instagram… le partage de ton téléphone.
            </span>
          </span>
          <img className={styles.chevron} src={chevron} alt="" />
        </button>
      )}
    </Feuille>
  )
}
