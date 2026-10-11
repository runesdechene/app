/**
 * QUOI     — l'appui long sur un message (au doigt), ou le clic droit (sur PC) : il ouvre ses actions.
 * POURQUOI — le geste des messageries pour modifier ou retirer son message (migration 502). Au doigt,
 *            le clic droit n'existe pas partout (iPhone) : un appui d'une demi-seconde, sans bouger,
 *            fait la même chose. `null` : rien ne s'ouvre (le message d'un autre).
 */
import { useEffect, useRef, type PointerEvent } from 'react'

const DUREE_MS = 500
const BOUGE_PX = 10 // au-delà, on fait défiler la liste : ce n'est plus un appui

export function useAppuiLong(onAppui: (() => void) | null) {
  const minuteur = useRef<number | null>(null)
  const depart = useRef({ x: 0, y: 0 })
  const arreter = () => {
    if (minuteur.current !== null) window.clearTimeout(minuteur.current)
    minuteur.current = null
  }
  useEffect(() => arreter, [])

  if (onAppui === null) return {}
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      depart.current = { x: e.clientX, y: e.clientY }
      minuteur.current = window.setTimeout(() => {
        minuteur.current = null
        onAppui()
      }, DUREE_MS)
    },
    onPointerMove: (e: PointerEvent) => {
      const { x, y } = depart.current
      if (Math.hypot(e.clientX - x, e.clientY - y) > BOUGE_PX) arreter()
    },
    onPointerUp: arreter,
    onPointerCancel: arreter,
    onContextMenu: (e: { preventDefault: () => void }) => {
      e.preventDefault()
      arreter()
      onAppui()
    },
  }
}
