import { useCallback, useEffect, useRef } from 'react'

/**
 * Rend un conteneur scrollable horizontalement « scrubable » à la souris
 * (cliquer-glisser). Souris uniquement (`pointerType === 'mouse'`) : sur
 * tactile/stylet, le scroll natif est conservé. Un drag réel (> seuil)
 * supprime le clic qui suit pour ne pas déclencher l'élément sous le curseur.
 *
 * Renvoie une *callback ref* (et non un objet ref) pour gérer les conteneurs
 * rendus conditionnellement (ex. après un état `loading`) : React rappelle la
 * callback au montage/démontage réel du nœud, donc les listeners s'attachent
 * quand l'élément apparaît vraiment.
 *
 * Usage : `const ref = useDragScroll<HTMLDivElement>()` puis `<div ref={ref}>`.
 */
export function useDragScroll<T extends HTMLElement>() {
  const cleanupRef = useRef<(() => void) | null>(null)

  const setNode = useCallback((el: T | null) => {
    // Démonte les listeners du nœud précédent.
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    if (!el) return

    let down = false
    let moved = false
    let startX = 0
    let startScroll = 0
    let pointerId = -1
    const THRESHOLD = 4

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      down = true
      moved = false
      startX = e.clientX
      startScroll = el!.scrollLeft
      pointerId = e.pointerId
    }

    function onPointerMove(e: PointerEvent) {
      if (!down) return
      const dx = e.clientX - startX
      if (!moved && Math.abs(dx) > THRESHOLD) {
        moved = true
        el!.classList.add('is-dragging')
        try { el!.setPointerCapture(pointerId) } catch { /* capture best-effort */ }
      }
      if (moved) {
        el!.scrollLeft = startScroll - dx
        e.preventDefault()
      }
    }

    function onPointerUp() {
      if (!down) return
      down = false
      el!.classList.remove('is-dragging')
    }

    // Supprime le clic consécutif à un drag (sinon ouvre la carte sous le curseur).
    function onClickCapture(e: MouseEvent) {
      if (moved) {
        e.stopPropagation()
        e.preventDefault()
        moved = false
      }
    }

    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    el.addEventListener('click', onClickCapture, true)

    cleanupRef.current = () => {
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('click', onClickCapture, true)
    }
  }, [])

  // Filet de sécurité au démontage du composant.
  useEffect(() => () => {
    if (cleanupRef.current) cleanupRef.current()
  }, [])

  return setNode
}
