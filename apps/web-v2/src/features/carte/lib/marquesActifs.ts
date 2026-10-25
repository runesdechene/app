/**
 * QUOI     — les marques des Actifs et de soi sur la carte (maquette « Carte — les Explorateurs
 *            actifs », 01/10) : un portrait et une étiquette par Explorateur, posés, déplacés,
 *            retirés à chaque relecture ; soi, à sa vraie position, son nom puis ses titres en dessous,
 *            et le toucher ouvre son profil (Uriel, 25/10).
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
// Soi sur la carte, lu dans son profil : `titres` = ses titres portés, déjà réunis (« A · B »).
export type Soi = { id: string; nom: string; avatar: string | null; titres: string | null }

function nomEtTitre(nom: string, titre: string | null): string {
  return titre ? `${nom} · ${titre}` : nom
}

// Un brouillé montre aussi son titre : la zone floue dit déjà « quelque part par ici » (Uriel, 25/10).
function etiquette(a: Actif): string {
  if (!a.enLigne) return `${a.nom} · ${ilYA(a.vuA)}`
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

export function suivreActifs(
  poser: Poser,
  onToucher: (id: string) => void,
  onToucherSoi: () => void,
) {
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
    moi(point: Point | null, soi: Omit<Soi, 'id'> | null) {
      if (!point || !soi) {
        moi?.marque.remove()
        moi = null
        return
      }
      const ou: [number, number] = [point.longitude, point.latitude]
      if (!moi) {
        const element = document.createElement('div')
        element.className = styles.moi ?? ''
        garderPourSoi(element)
        moi = { marque: poser(element, ou), element }
      } else {
        moi.marque.setLngLat(ou)
      }
      const halo = document.createElement('span')
      halo.className = styles.halo ?? ''
      const bouton = document.createElement('button')
      bouton.type = 'button'
      bouton.className = styles.portrait ?? ''
      bouton.setAttribute('aria-label', 'Mon profil')
      bouton.append(portrait(soi.avatar, soi.nom))
      bouton.addEventListener('click', onToucherSoi)
      // Le nom, puis les titres sur la ligne du dessous.
      const texte = document.createElement('span')
      texte.className = styles.etiquette ?? ''
      const nom = document.createElement('span')
      nom.textContent = soi.nom
      texte.append(nom)
      if (soi.titres) {
        const titres = document.createElement('span')
        titres.className = styles.titres ?? ''
        titres.textContent = soi.titres
        texte.append(titres)
      }
      moi.element.replaceChildren(halo, bouton, texte)
    },

    vider() {
      for (const { marque } of marques.values()) marque.remove()
      marques.clear()
      moi?.marque.remove()
      moi = null
    },
  }
}
