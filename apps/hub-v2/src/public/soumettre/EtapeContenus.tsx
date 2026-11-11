/**
 * QUOI     — « Tes photos » : les photos et vidéos (dix au plus), déposées ou choisies, en vignettes
 *            qu'on peut retirer. Facultatives sur le chemin « Un avis ».
 * POURQUOI — un fichier refusé l'est ici, avec son nom et la raison, avant que rien ne parte.
 */
import { useState, type DragEvent } from 'react'
import { MessageDErreur } from '../briques/MessageDErreur'
import { BoutonSombre, EnTete, Navigation } from './Etape'
import { estVideo, MAX_FICHIERS, trierLesAjouts } from './lib/fichiers'
import type { Contenu } from './lib/formulaire'
import styles from './EtapeContenus.module.css'

export function EtapeContenus({
  surTitre,
  facultatif,
  contenus,
  ajouter,
  retirer,
  precedent,
  suivant,
}: {
  surTitre: string
  facultatif: boolean
  contenus: Contenu[]
  ajouter: (fichiers: File[]) => void
  retirer: (rang: number) => void
  precedent: () => void
  suivant: () => void
}) {
  const [refus, setRefus] = useState<string[]>([])

  function recevoir(fichiers: File[]) {
    const tri = trierLesAjouts(contenus.length, fichiers)
    setRefus(tri.refus)
    ajouter(tri.acceptes)
  }

  function lacher(e: DragEvent) {
    e.preventDefault()
    recevoir(Array.from(e.dataTransfer.files))
  }

  return (
    <>
      <EnTete surTitre={surTitre} titre="Tes photos">
        {facultatif ? 'Facultatif : ' : ''}tes photos et vidéos en tenue Runes de Chêne — jusqu’à {MAX_FICHIERS}.
      </EnTete>


      <label
        className={styles.depot}
        onDragOver={(e) => {
          e.preventDefault()
        }}
        onDrop={lacher}
      >
        <input
          type="file"
          className={styles.fichier}
          accept="image/*,video/*,.heic,.heif"
          multiple
          onChange={(e) => {
            recevoir(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        ⬆ Glisse ou clique pour ajouter
      </label>

      {refus.length > 0 && (
        <div className={styles.refus}>
          <MessageDErreur>{refus.join(' · ')}</MessageDErreur>
        </div>
      )}

      {contenus.length > 0 && (
        <ul className={styles.vignettes}>
          {contenus.map((c, i) => (
            <li key={c.apercu} className={styles.vignette}>
              {estVideo(c.fichier) ? (
                <video src={c.apercu} muted playsInline preload="metadata" />
              ) : (
                <img src={c.apercu} alt="" />
              )}
              <button
                type="button"
                className={styles.retirer}
                aria-label={`Retirer « ${c.fichier.name} »`}
                onClick={() => {
                  retirer(i)
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <Navigation precedent={precedent}>
        <BoutonSombre disabled={!facultatif && contenus.length === 0} onClick={suivant}>
          {contenus.length === 0 && facultatif ? 'Continuer sans photo →' : 'Suivant →'}
        </BoutonSombre>
      </Navigation>
    </>
  )
}
