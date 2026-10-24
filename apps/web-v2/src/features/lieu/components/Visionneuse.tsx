/**
 * QUOI     — les photos d'un lieu en plein écran, sur un voile d'encre (maquette Figma 786:1996,
 *            piste A) : « 1 / 3 » et la croix en haut, la photo entière au milieu, le nom du lieu et
 *            les vignettes en bas. On passe d'une photo à l'autre avec la bande de la fiche ; un
 *            glissé vers le bas la fait reculer, et relâchée assez bas, elle se referme.
 * POURQUOI — Uriel, 24/10. Le <dialog> du navigateur : posé par-dessus toute l'app, le reste
 *            inerte, Échap compris. Il reste monté et ne fait que s'ouvrir et se fermer : il apparaît
 *            et s'efface en douceur, quelle que soit la façon de le fermer (croix, Échap, retour).
 * ATTENTION — l'ouverture vit dans l'adresse (la fiche porte `?photos`) : `onFermer` revient en
 *            arrière, la visionneuse ne se ferme jamais d'elle-même — Échap passe aussi par là.
 *            Le glissé pilote deux variables CSS sans rendu React, une image après l'autre.
 */
import { useEffect, useRef } from 'react'
import { DefilePhotos } from './DefilePhotos'
import { Vignettes } from './Vignettes'
import styles from './Visionneuse.module.css'

// Relâchée plus bas que ça, la photo se referme ; plus haut, elle remonte.
const FERMER_APRES_PX = 120
// La distance où le recul est complet (la photo au plus petit, le voile au plus clair).
const RECUL_COMPLET_PX = 400

// Tirer la photo de `px` vers le bas : `--tire` la déplace, `--recul` (0 à 1) la rapetisse et
// éclaircit le voile.
function tirer(fenetre: HTMLElement, px: number) {
  fenetre.style.setProperty('--tire', `${String(px)}px`)
  fenetre.style.setProperty('--recul', String(Math.min(px / RECUL_COMPLET_PX, 1)))
}

export function Visionneuse({
  ouverte,
  nom,
  photos,
  active,
  onChoisir,
  onFermer,
}: {
  ouverte: boolean
  nom: string
  photos: { url: string; vignette: string }[]
  active: number
  onChoisir: (i: number) => void
  onFermer: () => void
}) {
  const fenetre = useRef<HTMLDialogElement>(null)
  // Où le doigt s'est posé ; null quand rien n'est tiré.
  const depart = useRef<number | null>(null)

  useEffect(() => {
    const f = fenetre.current
    if (!f) return
    if (ouverte && !f.open) {
      tirer(f, 0)
      f.showModal()
    }
    if (!ouverte && f.open) f.close()
  }, [ouverte])

  function lacher(f: HTMLElement, px: number) {
    depart.current = null
    delete f.dataset.tire
    if (px > FERMER_APRES_PX) onFermer()
    else tirer(f, 0)
  }

  return (
    <dialog
      ref={fenetre}
      className={styles.visionneuse}
      aria-label={`Les photos de ${nom}`}
      onCancel={(e) => {
        e.preventDefault()
        onFermer()
      }}
      onPointerDown={(e) => {
        // Le glissé est un geste du doigt ; à la souris, la croix et Échap suffisent.
        if (e.pointerType === 'mouse') return
        depart.current = e.clientY
        e.currentTarget.dataset.tire = ''
      }}
      onPointerMove={(e) => {
        if (depart.current === null) return
        tirer(e.currentTarget, Math.max(0, e.clientY - depart.current))
      }}
      onPointerUp={(e) => {
        if (depart.current === null) return
        lacher(e.currentTarget, e.clientY - depart.current)
      }}
      // Le doigt part en travers : la bande défile, le navigateur reprend le geste.
      onPointerCancel={(e) => {
        lacher(e.currentTarget, 0)
      }}
    >
      <header className={styles.haut}>
        <p className={styles.compteur}>
          {active + 1} / {photos.length}
        </p>
        <button type="button" className={styles.fermer} aria-label="Fermer" onClick={onFermer} />
      </header>
      <div className={styles.scene}>
        <DefilePhotos photos={photos} active={active} onChoisir={onChoisir} entieres />
      </div>
      <footer className={styles.bas}>
        <p className={styles.nom}>{nom}</p>
        {photos.length > 1 && <Vignettes photos={photos} active={active} onChoisir={onChoisir} />}
      </footer>
    </dialog>
  )
}
