/**
 * QUOI     — vrai une fois que l'élément repère (la fin de la Charte) est passé à l'écran.
 * POURQUOI — Uriel, 27/09 : la Charte se lit en entier avant de pouvoir la signer. Le navigateur
 *            sait dire quand un élément devient visible (IntersectionObserver) ; sans lui, on ne
 *            bloque personne.
 */
import { useEffect, useRef, useState } from 'react'

export function useLuJusquauBout() {
  const repere = useRef<HTMLDivElement>(null)
  const [lu, setLu] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const element = repere.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observateur = new IntersectionObserver(([entree]) => {
      if (entree?.isIntersecting) {
        setLu(true)
        observateur.disconnect()
      }
    })
    observateur.observe(element)
    return () => {
      observateur.disconnect()
    }
  }, [])

  return { repere, lu }
}
