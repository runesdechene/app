/**
 * QUOI     — les Fragments sur la carte : une illustration par Fragment, posé à son origine, retiré quand
 *            il quitte la liste ; le toucher rend son id.
 */
import { expect, test, vi } from 'vitest'
import type { FragmentSurLaCarte } from '../api/lireFragments'
import type { Marque } from './marquesActifs'
import { suivreFragments } from './marquesFragments'

const fragment = (id: number, autre: Partial<FragmentSurLaCarte> = {}): FragmentSurLaCarte => ({
  id,
  nom: `Fragment ${String(id)}`,
  illustration: 'https://cdn.shopify.com/s/files/f.webp',
  heritage: null,
  origine: null,
  lat: 45,
  lng: 2,
  ...autre,
})

function monter() {
  const posees: { element: HTMLElement; ou: [number, number]; marque: Marque }[] = []
  const poser = vi.fn((element: HTMLElement, ou: [number, number]) => {
    const marque = { setLngLat: vi.fn(), remove: vi.fn() }
    posees.push({ element, ou, marque })
    return marque
  })
  const onToucher = vi.fn()
  return { suivi: suivreFragments(poser, onToucher), posees, onToucher }
}

test('une illustration par Fragment, posé à son origine, avec son illustration à la taille de la carte', () => {
  const { suivi, posees } = monter()
  suivi.fragments([fragment(11, { lat: 37.08, lng: 22.43 }), fragment(5)])
  expect(posees.map((p) => p.ou)).toEqual([[22.43, 37.08], [2, 45]])
  expect(posees[0]?.element.querySelector('img')?.getAttribute('src')).toBe(
    'https://cdn.shopify.com/s/files/f.webp?width=88',
  )
  expect(posees[0]?.element.querySelector('button')?.getAttribute('aria-label')).toBe('Fragment 11, son récit')
})

test('un Fragment qui quitte la liste perd sa marque ; vider retire tout', () => {
  const { suivi, posees } = monter()
  suivi.fragments([fragment(1), fragment(2)])
  suivi.fragments([fragment(2)])
  expect(posees[0]?.marque.remove).toHaveBeenCalled()
  suivi.vider()
  expect(posees.at(-1)?.marque.remove).toHaveBeenCalled()
})

test('sans illustration, l’initiale ; toucher l’illustration rend l’id du Fragment', () => {
  const { suivi, posees, onToucher } = monter()
  suivi.fragments([fragment(7, { nom: 'Hécate', illustration: null })])
  const bouton = posees[0]?.element.querySelector('button')
  expect(bouton?.textContent).toBe('H')
  bouton?.click()
  expect(onToucher).toHaveBeenCalledWith(7)
})
