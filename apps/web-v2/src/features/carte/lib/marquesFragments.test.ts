/**
 * QUOI     — les Fragments sur la carte : un éclat par Fragment, posé à son origine, le même pour tous
 *            (on ne sait pas lequel avant de toucher) ; retiré quand il quitte la liste ; le toucher
 *            rend son id.
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
  couleur: '#1d4e89',
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

test('un éclat par Fragment, posé à son origine, sans rien dire du Fragment', () => {
  const { suivi, posees } = monter()
  suivi.fragments([fragment(11, { nom: 'Hoplite', lat: 37.08, lng: 22.43 }), fragment(5)])
  expect(posees.map((p) => p.ou)).toEqual([[22.43, 37.08], [2, 45]])
  const element = posees[0]?.element
  expect(element?.textContent?.trim()).toBe('')
  expect(element?.querySelector('button')?.getAttribute('aria-label')).not.toContain('Hoplite')
  expect(element?.querySelector('img')).toBeNull()
})

test('l’éclat prend la couleur de la culture ; sans culture, il garde le rouge de la marque', () => {
  const { suivi, posees } = monter()
  suivi.fragments([fragment(1), fragment(2, { couleur: null })])
  expect(posees[0]?.element.style.getPropertyValue('--culture')).toBe('#1d4e89')
  expect(posees[1]?.element.style.getPropertyValue('--culture')).toBe('')
})

test('un Fragment qui quitte la liste perd sa marque ; vider retire tout', () => {
  const { suivi, posees } = monter()
  suivi.fragments([fragment(1), fragment(2)])
  suivi.fragments([fragment(2)])
  expect(posees[0]?.marque.remove).toHaveBeenCalled()
  suivi.vider()
  expect(posees.at(-1)?.marque.remove).toHaveBeenCalled()
})

test('toucher l’éclat rend l’id du Fragment', () => {
  const { suivi, posees, onToucher } = monter()
  suivi.fragments([fragment(7)])
  posees[0]?.element.querySelector('button')?.click()
  expect(onToucher).toHaveBeenCalledWith(7)
})
