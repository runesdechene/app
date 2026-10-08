/**
 * QUOI     — les Fragments sur la carte : une vignette par Fragment (une petite carte en hauteur qui
 *            porte l'illustration entière, un peu penchée), posée à son origine, qui flotte au-dessus
 *            de son ombre, et son nom dessous. Toucher la vignette ouvre son récit.
 * POURQUOI — décision du 08/10 : le calque Fragments est actif par défaut, chaque Fragment flotte avec
 *            la petite icône de son illustration ; la vignette (Uriel, 08/10) : une forme que rien
 *            d'autre n'a sur la carte (lieux et Explorateurs sont ronds), au format des dessins, qui
 *            rappelle la carte du récit et celle remise à l'achat. Une douzaine de marques : des éléments HTML
 *            suffisent (comme les Actifs), et le flottement est une animation CSS.
 * ATTENTION — une marque retirée est détruite (`remove`) : sinon elle reste accrochée à la carte.
 */
import { aLaTaille } from '@/shared/lib/image'
import type { FragmentSurLaCarte } from '../api/lireFragments'
import type { Marque, Poser } from './marquesActifs'
import styles from './marquesFragments.module.css'

const VIGNETTE = 40 // largeur de l'illustration ; elle garde ses proportions (164 × 227 dans le récit)

function vignette(f: FragmentSurLaCarte, onToucher: (id: number) => void): HTMLElement {
  const bouton = document.createElement('button')
  bouton.type = 'button'
  bouton.className = styles.vignette ?? ''
  // Penchée d'un côté ou de l'autre, pour que les Fragments ne soient pas alignés comme des étiquettes.
  bouton.dataset.penche = f.id % 2 === 0 ? 'gauche' : 'droite'
  bouton.setAttribute('aria-label', `${f.nom}, son récit`)
  if (f.illustration) {
    const img = document.createElement('img')
    img.src = aLaTaille(f.illustration, VIGNETTE)
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

function remplir(element: HTMLElement, f: FragmentSurLaCarte, onToucher: (id: number) => void) {
  const ombre = document.createElement('span')
  ombre.className = styles.ombre ?? ''
  const nom = document.createElement('span')
  nom.className = styles.nom ?? ''
  nom.textContent = f.nom
  element.replaceChildren(ombre, vignette(f, onToucher), nom)
}

// Un toucher sur une vignette ne descend pas jusqu'à la carte : sinon le lieu dessous s'ouvrirait aussi.
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
        remplir(element, f, onToucher)
        marques.set(f.id, poser(element, [f.lng, f.lat]))
      }
    },

    vider() {
      for (const marque of marques.values()) marque.remove()
      marques.clear()
    },
  }
}
