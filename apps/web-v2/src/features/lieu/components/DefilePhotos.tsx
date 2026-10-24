/**
 * QUOI     — les photos d'un lieu, en grand, qu'on fait défiler : au doigt, la bande glisse et se
 *            pose sur une photo ; à la souris (ou au doigt), deux flèches discrètes de chaque côté.
 * POURQUOI — Uriel, 02/10 : changer de photo sans passer par les vignettes. La bande est un
 *            défilement natif accroché aux photos (`scroll-snap`) : l'élan du doigt est celui du
 *            téléphone. Les photos suivantes ne se chargent qu'à l'approche.
 * ATTENTION — `active` vient de la fiche (les vignettes la changent aussi) : la bande y glisse si
 *            elle n'y est pas déjà, et les photos qu'elle traverse alors ne comptent pas. Glissée au
 *            doigt, elle ne dit la photo montrée qu'une fois posée — sinon chaque photo traversée
 *            deviendrait l'active, et la bande se contredirait en plein élan.
 *            Sur la fiche, toucher la bande ouvre la visionneuse (`onAgrandir`) : un glissé, lui,
 *            ne déclenche pas de clic. Dans la visionneuse, les photos sont `entieres`, sans recadrage.
 */
import { useEffect, useRef } from 'react'
import { aLaTaille } from '@/shared/lib/image'
import styles from './DefilePhotos.module.css'

const POSEE_APRES_MS = 120

type Photo = { url: string; vignette: string }

// La photo sur laquelle la bande est posée (une largeur de bande par photo).
function photoMontree(bande: HTMLElement): number | null {
  return bande.clientWidth > 0 ? Math.round(bande.scrollLeft / bande.clientWidth) : null
}

export function DefilePhotos({
  photos,
  active,
  onChoisir,
  onAgrandir,
  entieres = false,
}: {
  photos: Photo[]
  active: number
  onChoisir: (i: number) => void
  onAgrandir?: () => void
  entieres?: boolean
}) {
  const bande = useRef<HTMLDivElement>(null)
  const pose = useRef(0)
  // La photo vers laquelle la bande glisse à notre demande ; null quand c'est le doigt qui mène.
  const visee = useRef<number | null>(null)

  // La fiche (flèche, vignette) demande une photo : la bande y glisse.
  useEffect(() => {
    const b = bande.current
    if (!b || photoMontree(b) === null || photoMontree(b) === active) return
    visee.current = active
    const glisser = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    b.scrollTo({ left: active * b.clientWidth, behavior: glisser ? 'smooth' : 'auto' })
  }, [active])

  return (
    <div className={styles.defile}>
      <div
        ref={bande}
        className={styles.bande}
        data-agrandir={onAgrandir ? '' : undefined}
        // Au clavier aussi : la bande se choisit et Entrée l'ouvre en grand.
        tabIndex={onAgrandir ? 0 : undefined}
        aria-label={onAgrandir ? 'Voir les photos en grand' : undefined}
        onClick={onAgrandir}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onAgrandir?.()
        }}
        onPointerDown={() => {
          visee.current = null
        }}
        onScroll={() => {
          const b = bande.current
          if (!b) return
          if (visee.current !== null) {
            if (photoMontree(b) === visee.current) visee.current = null
            return
          }
          clearTimeout(pose.current)
          pose.current = window.setTimeout(() => {
            const i = photoMontree(b)
            if (i !== null && i !== active) onChoisir(i)
          }, POSEE_APRES_MS)
        }}
      >
        {photos.map((p, i) => (
          <img
            key={p.url}
            className={entieres ? styles.entiere : styles.photo}
            src={aLaTaille(p.url, 430)}
            alt={`Photo ${String(i + 1)} sur ${String(photos.length)}`}
            loading={i === 0 ? undefined : 'lazy'}
            decoding="async"
          />
        ))}
      </div>
      {photos.length > 1 && active > 0 && (
        <button
          type="button"
          className={styles.precedente}
          aria-label="Photo précédente"
          onClick={() => {
            onChoisir(active - 1)
          }}
        />
      )}
      {photos.length > 1 && active < photos.length - 1 && (
        <button
          type="button"
          className={styles.suivante}
          aria-label="Photo suivante"
          onClick={() => {
            onChoisir(active + 1)
          }}
        />
      )}
    </div>
  )
}
