/**
 * QUOI     — les Fragments sur la carte : l'illustration elle-même, sans cadre, posée à son origine
 *            sur un halo de parchemin qui s'efface vers les bords (Figma 513:802, proposition E
 *            retenue par Uriel le 08/10). La toucher ouvre son récit.
 * POURQUOI — un Fragment tient la place d'un lieu : de la publicité bonus qui ne gêne pas. Les
 *            dessins sont à l'encre : le halo éclaircit juste la carte dessous pour qu'ils se lisent.
 *            Une douzaine de marques : des éléments HTML suffisent (comme les Actifs) ; leur taille
 *            suit le zoom par la variable `--echelle-fragments` que pose le hook.
 * ATTENTION — une marque retirée est détruite (`remove`) : sinon elle reste accrochée à la carte.
 */
import { aLaTaille } from '@/shared/lib/image'
import type { FragmentSurLaCarte } from '../api/lireFragments'
import type { Marque, Poser } from './marquesActifs'
import styles from './marquesFragments.module.css'

const ILLUSTRATION = 44 // la largeur la plus grande à laquelle elle s'affiche (zoomé de près)

function illustration(f: FragmentSurLaCarte, onToucher: (id: number) => void): HTMLElement {
  const bouton = document.createElement('button')
  bouton.type = 'button'
  bouton.className = styles.illustration ?? ''
  bouton.setAttribute('aria-label', `${f.nom}, son récit`)
  if (f.illustration) {
    const img = document.createElement('img')
    img.src = aLaTaille(f.illustration, ILLUSTRATION)
    img.decoding = 'async'
    img.alt = ''
    bouton.append(img)
  } else {
    bouton.textContent = f.nom.charAt(0)
  }
  bouton.addEventListener('click', () => {
    onToucher(f.id)
  })
  return bouton
}

// Un toucher sur un Fragment ne descend pas jusqu'à la carte : sinon le lieu dessous s'ouvrirait aussi.
function garderPourSoi(element: HTMLElement) {
  for (const type of ['mousedown', 'pointerdown', 'touchstart', 'click']) {
    element.addEventListener(type, (e) => {
      e.stopPropagation()
    })
  }
}

export function suivreFragments(poser: Poser, onToucher: (id: number) => void) {
  const marques = new Map<number, Marque>()

  return {
    fragments(fragments: FragmentSurLaCarte[]) {
      const presents = new Set(fragments.map((f) => f.id))
      for (const [id, marque] of marques) {
        if (!presents.has(id)) {
          marque.remove()
          marques.delete(id)
        }
      }
      for (const f of fragments) {
        marques.get(f.id)?.remove()
        const element = document.createElement('div')
        element.className = styles.fragment ?? ''
        garderPourSoi(element)
        element.append(illustration(f, onToucher))
        marques.set(f.id, poser(element, [f.lng, f.lat]))
      }
    },

    vider() {
      for (const marque of marques.values()) marque.remove()
      marques.clear()
    },
  }
}
