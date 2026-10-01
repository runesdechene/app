/**
 * QUOI     — les marques des Actifs et de soi : une par Explorateur, posées, déplacées, retirées.
 */
import { expect, test, vi } from 'vitest'
import type { Actif } from '../api/lireActifs'
import { suivreActifs, type Marque } from './marquesActifs'

const actif = (id: string, autre: Partial<Actif> = {}): Actif => ({
  id,
  nom: id,
  avatar: null,
  niveau: 3,
  titre: 'Arpenteur',
  signe: null,
  lat: 45,
  lng: 1,
  brouille: false,
  vuA: new Date().toISOString(),
  enLigne: true,
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
  return { suivi: suivreActifs(poser, onToucher), posees, poser, onToucher }
}

test('une marque par Actif ; celle d’un parti est retirée, les autres restent', () => {
  const { suivi, posees, poser } = monter()
  suivi.actifs([actif('kelpie'), actif('luna')])
  expect(poser).toHaveBeenCalledTimes(2)
  suivi.actifs([actif('kelpie', { lat: 46 })])
  expect(poser).toHaveBeenCalledTimes(2)
  expect(posees[0]?.marque.setLngLat).toHaveBeenCalledWith([1, 46])
  expect(posees[1]?.marque.remove).toHaveBeenCalled()
})

test('l’étiquette dit le titre, « quelque part par ici », ou depuis quand', () => {
  const { suivi, posees } = monter()
  suivi.actifs([
    actif('Kelpie'),
    actif('Mathéo', { brouille: true }),
    actif('Luna', { enLigne: false, vuA: new Date(Date.now() - 23 * 60_000).toISOString() }),
    actif('Aelis', { titre: null }),
  ])
  const textes = posees.map((p) => p.element.lastElementChild?.textContent)
  expect(textes[0]).toBe('Kelpie · Arpenteur')
  expect(textes[1]).toBe('Mathéo · quelque part par ici')
  expect(textes[2]).toMatch(/^Luna · il y a 23\smin$/)
  expect(textes[3]).toBe('Aelis')
  expect(posees[1]?.element.dataset.brouille).toBe('true')
  expect(posees[2]?.element.dataset.recent).toBe('true')
})

test('toucher une marque ouvre l’Explorateur', () => {
  const { suivi, posees, onToucher } = monter()
  suivi.actifs([actif('kelpie')])
  posees[0]?.element.querySelector('button')?.click()
  expect(onToucher).toHaveBeenCalledWith('kelpie')
})

test('toucher un portrait ne touche pas la carte dessous (le lieu sous ses pieds)', () => {
  const { suivi, posees, onToucher } = monter()
  suivi.actifs([actif('kelpie')])
  const element = posees[0]?.element
  if (!element) throw new Error('pas de marque')
  const parent = document.createElement('div')
  parent.append(element)
  const carte = vi.fn()
  for (const type of ['mousedown', 'pointerdown', 'click', 'touchstart']) {
    parent.addEventListener(type, carte)
  }
  const bouton = element.querySelector('button')
  for (const type of ['mousedown', 'pointerdown', 'touchstart']) {
    bouton?.dispatchEvent(new Event(type, { bubbles: true }))
  }
  bouton?.click()
  expect(onToucher).toHaveBeenCalledWith('kelpie')
  expect(carte).not.toHaveBeenCalled()
})

test('soi : rien sans position, « Toi » à sa position, puis suivi', () => {
  const { suivi, posees, poser } = monter()
  suivi.moi(null, null)
  expect(poser).not.toHaveBeenCalled()
  suivi.moi({ latitude: 45, longitude: 1 }, 'moi.jpg')
  expect(posees[0]?.element.textContent).toContain('Toi')
  expect(posees[0]?.ou).toEqual([1, 45])
  suivi.moi({ latitude: 46, longitude: 2 }, 'moi.jpg')
  expect(poser).toHaveBeenCalledTimes(1)
  expect(posees[0]?.marque.setLngLat).toHaveBeenCalledWith([2, 46])
})

test('vider retire tout', () => {
  const { suivi, posees } = monter()
  suivi.actifs([actif('kelpie')])
  suivi.moi({ latitude: 45, longitude: 1 }, null)
  suivi.vider()
  expect(posees.every((p) => vi.mocked(p.marque.remove).mock.calls.length === 1)).toBe(true)
})
