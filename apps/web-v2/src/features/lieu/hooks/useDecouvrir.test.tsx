/**
 * QUOI     — une découverte relit la carte et les profils tout de suite, mais la fiche seulement
 *            quand on choisit d'y accéder : la récompense reste à l'écran jusque-là.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { useDecouvrir } from './useDecouvrir'

const RECOMPENSE = { rang: 38, gain: 1, niveau: 12, avant: 0.62, apres: 0.64 }
const api = vi.hoisted(() => ({
  decouvrirLieu: vi.fn(() =>
    Promise.resolve({ rang: 38, gain: 1, niveau: 12, avant: 0.62, apres: 0.64 }),
  ),
}))
vi.mock('../api/lieu', () => api)

function monter() {
  const client = new QueryClient()
  client.setQueryData(['lieu', 'a'], {
    id: 'a',
    moi: { visiteLe: null, envie: false, decouvert: false },
  })
  const relire = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const rendu = renderHook(() => useDecouvrir('a', null), { wrapper })
  return { client, relire, ...rendu }
}

test('une découverte rend sa récompense et relit la carte et les profils, pas la fiche', async () => {
  const { result, relire } = monter()
  act(() => {
    result.current.decouvrir()
  })
  await waitFor(() => {
    expect(result.current.recompense).toEqual(RECOMPENSE)
  })
  expect(relire).toHaveBeenCalledWith({ queryKey: ['carte', 'lieux'] })
  expect(relire).toHaveBeenCalledWith({ queryKey: ['explorateur'] })
  expect(relire).not.toHaveBeenCalledWith({ queryKey: ['lieu', 'a'] })
})

test('accéder au lieu marque la fiche découverte : elle s’ouvre', () => {
  const { result, client } = monter()
  act(() => {
    result.current.acceder()
  })
  expect(client.getQueryData(['lieu', 'a'])).toMatchObject({ moi: { decouvert: true } })
})
