/**
 * QUOI     — étape 1, « Tes contenus » : la mission éventuelle, puis les photos et vidéos (dix au
 *            plus), déposées ou choisies, en vignettes qu'on peut retirer.
 * POURQUOI — la mission vaut « envoi libre » tant que le joueur ne la choisit pas : `?quete=` (le
 *            lien d'une mission) la présélectionne seulement, il la voit et peut la changer. Un
 *            fichier refusé l'est ici, avec son nom et la raison, avant que rien ne parte.
 */
import { useState, type DragEvent } from 'react'
import { MessageDErreur } from '../briques/MessageDErreur'
import type { Mission } from './api'
import { BoutonSombre, EnTete, Navigation } from './Etape'
import { estVideo, MAX_FICHIERS, trierLesAjouts } from './lib/fichiers'
import type { Contenu } from './lib/formulaire'
import etape from './Etape.module.css'
import styles from './EtapeContenus.module.css'

export function EtapeContenus({
  missions,
  mission,
  choisirMission,
  contenus,
  ajouter,
  retirer,
  suivant,
}: {
  missions: Mission[]
  mission: string
  choisirMission: (slug: string) => void
  contenus: Contenu[]
  ajouter: (fichiers: File[]) => void
  retirer: (rang: number) => void
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
      <EnTete n={1} titre="Tes contenus">
        Dépose tes photos et vidéos — jusqu’à {MAX_FICHIERS}.
      </EnTete>

      {missions.length > 0 && (
        <div className={styles.mission}>
          <label className={etape.libelle} htmlFor="mission">
            Ces contenus répondent-ils à une mission en cours ?
          </label>
          <select
            id="mission"
            className={etape.champ}
            value={mission}
            onChange={(e) => {
              choisirMission(e.target.value)
            }}
          >
            <option value="">Envoi libre — aucune mission</option>
            {missions.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.title}
              </option>
            ))}
          </select>
          <p className={etape.aide}>
            Choisis une mission seulement si tes contenus correspondent à son thème. Sinon, laisse « Envoi libre ».
          </p>
        </div>
      )}

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

      <Navigation>
        <BoutonSombre disabled={contenus.length === 0} onClick={suivant}>
          Suivant →
        </BoutonSombre>
      </Navigation>
    </>
  )
}
