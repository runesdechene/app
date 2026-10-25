/**
 * QUOI     — la rose des vents, en bas à gauche de la carte : elle tourne avec la carte et pointe
 *            toujours le vrai nord ; la toucher remet le nord en haut (Uriel, 25/10).
 * POURQUOI — la rotation s'écrit directement sur l'image à chaque événement `rotate` de MapLibre :
 *            pas de rendu React à chaque image du geste. Le relief (l'inclinaison) ne bouge pas.
 */
import { useEffect, useRef } from 'react'
import roseDesVents from '@/assets/ui/rose-des-vents.svg'
import styles from './CarteScreen.module.css'

// Ce que la rose demande à la carte, et rien de plus.
type Boussole = {
  getBearing: () => number
  on: (type: 'rotate', ecouteur: () => void) => unknown
  off: (type: 'rotate', ecouteur: () => void) => unknown
  resetNorth: () => unknown
}

export function RoseDesVents({ carte }: { carte: Boussole | null }) {
  const image = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!carte) return
    const suivre = () => {
      if (image.current) image.current.style.rotate = `${String(-carte.getBearing())}deg`
    }
    suivre()
    carte.on('rotate', suivre)
    return () => {
      carte.off('rotate', suivre)
    }
  }, [carte])

  return (
    <button
      type="button"
      className={styles.rose}
      aria-label="Remettre le nord en haut"
      onClick={() => carte?.resetNorth()}
    >
      <img ref={image} src={roseDesVents} alt="" />
    </button>
  )
}
