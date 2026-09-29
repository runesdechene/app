/**
 * QUOI     — l'étape « Photo » (maquette 288:147) : le lieu tel qu'on le voit, en plein écran.
 *            Le déclencheur ouvre l'appareil du téléphone, « Galerie » les photos déjà prises ;
 *            les photos choisies s'alignent en vignettes (la première est la principale : toucher
 *            une autre la met devant ; la croix la retire).
 * POURQUOI — la photo deviendra la fiche : on commence par elle. Chaque photo est réduite dès
 *            qu'elle est choisie (lib/photo) ; la position de la première, si l'appareil l'a
 *            notée, placera l'épingle à l'étape suivante.
 * ATTENTION — le viseur est celui du téléphone (`capture`) : pas de flux vidéo maison.
 */
import { useState } from 'react'
import type { PhotoBrouillon, ProprietesEtape } from '../lib/brouillon'
import { positionDeLaPhoto, preparerPhoto } from '../lib/photo'
import { useUrlDe } from '../hooks/useUrlDe'
import styles from './EtapePhoto.module.css'

const MAX_PHOTOS = 10

export function EtapePhoto({ brouillon, changer, onSuivant }: ProprietesEtape) {
  const { photos } = brouillon
  const [enPreparation, setEnPreparation] = useState(0)
  const [illisible, setIllisible] = useState(false)
  const principale = useUrlDe(photos[0]?.grande)
  // Pendant la préparation, les photos sont figées : la liste d'arrivée se calcule sur celle du départ.
  const occupe = enPreparation > 0

  async function ajouter(fichiers: FileList | null) {
    const choisis = [...(fichiers ?? [])].slice(0, MAX_PHOTOS - photos.length)
    if (choisis.length === 0) return
    setIllisible(false)
    setEnPreparation(choisis.length)
    const nouvelles: PhotoBrouillon[] = []
    let position = brouillon.positionPhoto
    for (const fichier of choisis) {
      try {
        nouvelles.push({ id: crypto.randomUUID(), ...(await preparerPhoto(fichier)) })
        position ??= await positionDeLaPhoto(fichier)
      } catch {
        setIllisible(true)
      }
      setEnPreparation((n) => n - 1)
    }
    changer({ photos: [...photos, ...nouvelles], positionPhoto: position })
  }

  const surChoix = (e: React.ChangeEvent<HTMLInputElement>) => {
    void ajouter(e.target.files)
    e.target.value = '' // la même photo peut être reprise plus tard
  }

  return (
    <div className={styles.photo}>
      {principale ? (
        <img className={styles.fond} src={principale} alt="" />
      ) : (
        <div className={styles.fondVide} aria-hidden="true" />
      )}
      <div className={styles.voile} aria-hidden="true" />

      <div className={styles.texte}>
        <h1 className={styles.titre}>Commence par une photo</h1>
        <p className={styles.chapo}>
          Le lieu tel que tu le vois. Elle deviendra sa fiche — et elle sait souvent où elle a été
          prise.
        </p>
      </div>

      <div className={styles.bas}>
        {photos.length > 0 && (
          <ul className={styles.vignettes} aria-label="Tes photos">
            {photos.map((p, i) => (
              <Vignette
                key={p.id}
                photo={p}
                principale={i === 0}
                occupe={occupe}
                onPrincipale={() => {
                  changer({ photos: [p, ...photos.filter((q) => q.id !== p.id)] })
                }}
                onRetirer={() => {
                  changer({ photos: photos.filter((q) => q.id !== p.id) })
                }}
              />
            ))}
          </ul>
        )}
        {enPreparation > 0 && (
          <p className={styles.etat} role="status">
            Préparation de {enPreparation > 1 ? `${String(enPreparation)} photos` : 'la photo'}…
          </p>
        )}
        {illisible && (
          <p className={styles.etat} role="alert">
            Une photo n’a pas pu être lue. Essaie avec une autre.
          </p>
        )}

        <div className={styles.commandes}>
          <label className={styles.galerie}>
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={occupe || photos.length >= MAX_PHOTOS}
              onChange={surChoix}
            />
            <span className={styles.iconeGalerie} aria-hidden="true" />
            Galerie
          </label>
          <label className={styles.declencheur}>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              disabled={occupe || photos.length >= MAX_PHOTOS}
              onChange={surChoix}
            />
            <span className={styles.rond} aria-hidden="true" />
            <span className={styles.cache}>Prendre une photo</span>
          </label>
          <button
            type="button"
            className={styles.suivant}
            disabled={photos.length === 0 || occupe}
            onClick={onSuivant}
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  )
}

function Vignette({
  photo,
  principale,
  occupe,
  onPrincipale,
  onRetirer,
}: {
  photo: PhotoBrouillon
  principale: boolean
  occupe: boolean
  onPrincipale: () => void
  onRetirer: () => void
}) {
  const url = useUrlDe(photo.vignette)
  return (
    <li className={styles.vignette} data-principale={principale || undefined}>
      <button
        type="button"
        className={styles.choisir}
        aria-label={principale ? 'Photo principale' : 'Faire de cette photo la principale'}
        aria-pressed={principale}
        disabled={occupe}
        onClick={onPrincipale}
      >
        {url && <img src={url} alt="" />}
      </button>
      <button
        type="button"
        className={styles.retirer}
        aria-label="Retirer"
        disabled={occupe}
        onClick={onRetirer}
      >
        <span aria-hidden="true">×</span>
      </button>
    </li>
  )
}
