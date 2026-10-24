/**
 * QUOI     — la rangée des vignettes d'un lieu : toucher l'une montre sa photo, la photo montrée
 *            est cerclée. Sous la photo de la fiche, et en bas de la visionneuse.
 * POURQUOI — une seule rangée pour les deux (24/10). Quand la photo change (au doigt, aux flèches),
 *            sa vignette se range dans la partie visible : beaucoup de photos font défiler la rangée.
 */
import { useEffect, useRef } from 'react'
import { aLaTaille } from '@/shared/lib/image'
import styles from './Vignettes.module.css'

export function Vignettes({
  photos,
  active,
  onChoisir,
}: {
  photos: { url: string; vignette: string }[]
  active: number
  onChoisir: (i: number) => void
}) {
  const rangee = useRef<HTMLDivElement>(null)
  useEffect(() => {
    rangee.current?.children[active]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [active])

  return (
    <div ref={rangee} className={styles.vignettes}>
      {photos.map((p, i) => (
        <button
          key={p.url}
          type="button"
          className={styles.vignette}
          aria-label={`Photo ${String(i + 1)}`}
          aria-pressed={i === active}
          onClick={() => {
            onChoisir(i)
          }}
        >
          <img src={aLaTaille(p.vignette, 33)} alt="" loading="lazy" decoding="async" />
        </button>
      ))}
    </div>
  )
}
