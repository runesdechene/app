/**
 * QUOI     — tenir et tirer une rangée à la souris pour la faire défiler (fragments, lieux).
 * POURQUOI — au doigt, une rangée `overflow-x: auto` défile déjà ; à la souris, non : sur PC on
 *            ne pouvait pas « tenir et scroller » (Uriel, 27/09). Seule la souris est prise en
 *            charge ici ; le tactile garde le défilement natif du navigateur.
 * ATTENTION — le hook rend une ref à poser sur la rangée (`<ul ref={glisser}>`), pas un
 *            useRef : React la rappelle quand la rangée apparaît. Une rangée qui n'existe
 *            qu'après le chargement des données (les Ajoutés de l'Accueil) ne glissait pas, les
 *            écouteurs ayant été posés sur rien au premier rendu (Uriel, 28/09).
 *            Un glissé de plus de 5 px annule le clic qui suit, pour qu'on n'ouvre pas une
 *            carte en la lâchant. Un simple clic, lui, passe.
 */
import { useEffect, useState } from 'react'

const SEUIL_PX = 5

export function useGlisser(): (zone: HTMLElement | null) => void {
  const [zone, setZone] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!zone) return

    let depart: { x: number; defilement: number } | null = null
    let glisse = false

    function presse(e: PointerEvent) {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !zone) return
      depart = { x: e.clientX, defilement: zone.scrollLeft }
      glisse = false
    }

    function bouge(e: PointerEvent) {
      if (!depart || !zone) return
      const dx = e.clientX - depart.x
      if (Math.abs(dx) > SEUIL_PX) glisse = true
      zone.scrollLeft = depart.defilement - dx
    }

    function lache() {
      depart = null
    }

    function clic(e: MouseEvent) {
      if (!glisse) return
      e.stopPropagation()
      e.preventDefault()
      glisse = false
    }

    zone.addEventListener('pointerdown', presse)
    zone.addEventListener('pointermove', bouge)
    zone.addEventListener('pointerup', lache)
    zone.addEventListener('pointerleave', lache)
    zone.addEventListener('click', clic, true)
    return () => {
      zone.removeEventListener('pointerdown', presse)
      zone.removeEventListener('pointermove', bouge)
      zone.removeEventListener('pointerup', lache)
      zone.removeEventListener('pointerleave', lache)
      zone.removeEventListener('click', clic, true)
    }
  }, [zone])

  return setZone
}
