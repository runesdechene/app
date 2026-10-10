/**
 * QUOI     — l'analyse : le modèle chargé, le bip transmis, et l'échec du modèle dit (pas d'attente sans fin).
 */
import { renderHook, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

const chargerModele = vi.hoisted(() => vi.fn())
vi.mock('../lib/modele', () => ({ chargerModele, MODELE: 'mobilenet_v3_small' }))
vi.mock('../lib/viseur', () => ({ cadrer: () => document.createElement('canvas') }))

import { useAnalyse } from './useAnalyse'

function video() {
  const v = document.createElement('video')
  Object.defineProperty(v, 'readyState', { value: 4 })
  return { current: v }
}

test('un modèle qui ne se charge pas rend `erreur`', async () => {
  chargerModele.mockRejectedValueOnce(new Error('wasm'))
  const { result } = renderHook(() => useAnalyse(video(), [], true, vi.fn()))
  await waitFor(() => {
    expect(result.current.erreur).toBe(true)
  })
  expect(result.current.pret).toBe(false)
})

test('un viseur qui ressemble nettement à un Fragment, image après image, bipe ce Fragment', async () => {
  chargerModele.mockResolvedValueOnce(() => [1, 0])
  const surBip = vi.fn()
  const refs = [
    { fragment: 7, vecteur: [1, 0] },
    { fragment: 8, vecteur: [0, 1] },
  ]
  const ref = video() // une seule ref, comme dans l'écran
  renderHook(() => useAnalyse(ref, refs, true, surBip))
  await waitFor(
    () => {
      expect(surBip).toHaveBeenCalledWith(7)
    },
    { timeout: 3000 },
  )
})

test('une analyse qui échoue en cours de route (contexte GPU perdu) rend `erreur` et s’arrête', async () => {
  const empreinteur = vi.fn(() => {
    throw new Error('contexte perdu')
  })
  chargerModele.mockResolvedValueOnce(empreinteur)
  const ref = video()
  const { result } = renderHook(() =>
    useAnalyse(ref, [{ fragment: 7, vecteur: [1, 0] }], true, vi.fn()),
  )
  await waitFor(() => {
    expect(result.current.erreur).toBe(true)
  })
  const appels = empreinteur.mock.calls.length
  await new Promise((fini) => setTimeout(fini, 400))
  expect(empreinteur.mock.calls.length).toBe(appels)
})
