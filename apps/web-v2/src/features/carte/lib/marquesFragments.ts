/**
 * QUOI     — les Fragments sur la carte : un éclat de cristal taillé, le même pour tous, à la couleur
 *            de la culture du Fragment, posé à son origine. Le toucher ouvre son récit.
 * POURQUOI — Uriel, 08/10 : un pictogramme unique (Figma 516:659), de la taille d'un lieu ; on ignore
 *            quel Fragment c'est tant qu'on ne l'a pas touché — c'est la surprise qui fait toucher ;
 *            sa couleur dit seulement de quel monde il vient (Uriel, 08/10). Le dessin est en ligne :
 *            ses facettes se teintent en CSS à partir de `--culture`.
 *            Une douzaine de marques : des éléments HTML suffisent (comme les Actifs) ; leur taille
 *            suit le zoom par la variable `--echelle-fragments` que pose le hook.
 * ATTENTION — une marque retirée est détruite (`remove`) : sinon elle reste accrochée à la carte.
 */
import type { FragmentSurLaCarte } from '../api/lireFragments'
import type { Marque, Poser } from './marquesActifs'
import styles from './marquesFragments.module.css'

// L'éclat taillé (Figma 516:659) : chaque facette nomme sa teinte, calculée dans le CSS.
const ECLAT = `<svg viewBox="-1 -1 22 38" aria-hidden="true">
<path d="M10 0L19 9L17 26L10 36L3 26L1 9Z" fill="var(--eclat-base)"/>
<path d="M10 0L1 9L10 11Z" fill="var(--eclat-clair)"/>
<path d="M10 0L19 9L10 11Z" fill="var(--eclat-rose)"/>
<path d="M1 9L10 11V28L3 26Z" fill="var(--eclat-moyen)"/>
<path d="M19 9L10 11V28L17 26Z" fill="var(--eclat-sombre)"/>
<path d="M3 26L10 28V36Z" fill="var(--eclat-base)"/>
<path d="M17 26L10 28V36Z" fill="var(--eclat-nuit)"/>
<path d="M4.5 13L5.5 22" stroke="var(--color-sur-accent)" stroke-opacity="0.75" stroke-width="1.2" stroke-linecap="round"/>
<path d="M10 0L19 9L17 26L10 36L3 26L1 9Z" fill="none" stroke="var(--color-sur-accent)" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`

function eclatDe(f: FragmentSurLaCarte, onToucher: (id: number) => void): HTMLElement {
  const bouton = document.createElement('button')
  bouton.type = 'button'
  bouton.className = styles.eclat ?? ''
  bouton.setAttribute('aria-label', 'Un Fragment : découvrir son récit')
  bouton.innerHTML = ECLAT
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
        if (f.couleur) element.style.setProperty('--culture', f.couleur)
        garderPourSoi(element)
        element.append(eclatDe(f, onToucher))
        marques.set(f.id, poser(element, [f.lng, f.lat]))
      }
    },

    vider() {
      for (const marque of marques.values()) marque.remove()
      marques.clear()
    },
  }
}
