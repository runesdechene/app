/**
 * QUOI     — les marques des Actifs et de soi sur la carte (maquette « Carte — les Explorateurs
 *            actifs », 01/10) : un portrait et une étiquette par Explorateur, posés, déplacés,
 *            retirés à chaque relecture ; soi, cerclé de rouge, à sa vraie position, avec son nom
 *            et son titre comme les autres (Uriel, 06/10 : plus « Toi »).
 * POURQUOI — des portraits, pas des icônes : ce sont des personnes. Quelques dizaines tout au plus,
 *            des éléments HTML suffisent (MapLibre les déplace avec la carte). Qui pose une marque
 *            vient d'ailleurs (`poser`) : la carte réelle en vrai, une fausse en test.
 * ATTENTION — une marque retirée est détruite (`remove`) : sinon elle reste accrochée à la carte.
 */
import { aLaTaille } from '@/shared/lib/image'
import type { Point } from '@/shared/lib/distance'
import { ilYA } from '@/shared/lib/ilYA'
import type { Actif } from '../api/lireActifs'
import styles from './marquesActifs.module.css'

export type Marque = { setLngLat: (ou: [number, number]) => unknown; remove: () => unknown }
export type Poser = (element: HTMLElement, ou: [number, number]) => Marque
// Soi sur la carte : ce que sa marque affiche, lu dans son profil.
export type Soi = { nom: string; avatar: string | null; titre: string | null }

function nomEtTitre(nom: string, titre: string | null): string {
  return titre ? `${nom} · ${titre}` : nom
}

function etiquette(a: Actif): string {
  if (!a.enLigne) return `${a.nom} · ${ilYA(a.vuA)}`
  if (a.brouille) return `${a.nom} · quelque part par ici`
  return nomEtTitre(a.nom, a.titre)
}

function portrait(avatar: string | null, nom: string): HTMLElement {
  if (avatar) {
    const img = document.createElement('img')
    img.src = aLaTaille(avatar, 36)
    img.decoding = 'async'
    img.alt = ''
    return img
  }
  const initiale = document.createElement('span')
  initiale.textContent = nom.charAt(0).toUpperCase()
  return initiale
}

// Le contenu d'une marque : refait à chaque relecture (le nom, l'état ou l'heure changent).
function remplir(element: HTMLElement, a: Actif, onToucher: (id: string) => void) {
  const bouton = document.createElement('button')
  bouton.type = 'button'
  bouton.className = styles.portrait ?? ''
  bouton.setAttribute('aria-label', a.nom)
  bouton.append(portrait(a.avatar, a.nom))
  bouton.addEventListener('click', () => {
    onToucher(a.id)
  })
  const texte = document.createElement('span')
  texte.className = styles.etiquette ?? ''
  texte.textContent = etiquette(a)
  element.replaceChildren(bouton, texte)
  element.dataset.brouille = String(a.brouille)
  element.dataset.recent = String(!a.enLigne)
}

// Un toucher sur un portrait ne descend pas jusqu'à la carte : sinon le lieu sous les pieds de
// l'Explorateur s'ouvrirait en même temps que sa carte (MapLibre écoute ces gestes sur la carte).
function garderPourSoi(element: HTMLElement) {
  for (const type of ['mousedown', 'pointerdown', 'touchstart', 'click']) {
    element.addEventListener(type, (e) => {
      e.stopPropagation()
    })
  }
}

export function suivreActifs(poser: Poser, onToucher: (id: string) => void) {
  const marques = new Map<string, { marque: Marque; element: HTMLElement }>()
  let moi: { marque: Marque; element: HTMLElement } | null = null

  return {
    actifs(actifs: Actif[]) {
      const presents = new Set(actifs.map((a) => a.id))
      for (const [id, { marque }] of marques) {
        if (!presents.has(id)) {
          marque.remove()
          marques.delete(id)
        }
      }
      for (const a of actifs) {
        const ou: [number, number] = [a.lng, a.lat]
        const deja = marques.get(a.id)
        if (deja) {
          remplir(deja.element, a, onToucher)
          deja.marque.setLngLat(ou)
          continue
        }
        const element = document.createElement('div')
        element.className = styles.actif ?? ''
        garderPourSoi(element)
        remplir(element, a, onToucher)
        marques.set(a.id, { marque: poser(element, ou), element })
      }
    },

    // Sans position ou sans profil (pas encore lu), pas de marque. Le contenu est refait à chaque
    // appel : le profil peut arriver après la position, ou changer (nouveau portrait).
    moi(point: Point | null, soi: Soi | null) {
      if (!point || !soi) {
        moi?.marque.remove()
        moi = null
        return
      }
      const ou: [number, number] = [point.longitude, point.latitude]
      if (!moi) {
        const element = document.createElement('div')
        element.className = styles.moi ?? ''
        moi = { marque: poser(element, ou), element }
      } else {
        moi.marque.setLngLat(ou)
      }
      const halo = document.createElement('span')
      halo.className = styles.halo ?? ''
      const cadre = document.createElement('span')
      cadre.className = styles.portrait ?? ''
      cadre.append(portrait(soi.avatar, soi.nom))
      const texte = document.createElement('span')
      texte.className = styles.etiquette ?? ''
      texte.textContent = nomEtTitre(soi.nom, soi.titre)
      moi.element.replaceChildren(halo, cadre, texte)
    },

    vider() {
      for (const { marque } of marques.values()) marque.remove()
      marques.clear()
      moi?.marque.remove()
      moi = null
    },
  }
}
