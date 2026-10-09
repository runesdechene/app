/**
 * QUOI     — saluer ajoute un cœur tout de suite, autant de fois qu'on touche ; la rafale finie,
 *            le fil se relit (la base fait foi), même après un refus.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { useSaluer } from './useSaluer'

const api = vi.hoisted(() => ({ saluer: vi.fn() }))
vi.mock('../api/accueil', () => api)

const LIGNE = { id: 'visite:l1:u1', saluts: 2, salue: false }
const CLE = ['accueil', 'chemins']

function monter() {
  const client = new QueryClient()
  client.setQueryData(CLE, [LIGNE])
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useSaluer(), { wrapper })
  return { client, saluer: result.current }
}

test('chaque toucher ajoute un cœur tout de suite ; la rafale finie, le fil se relit', async () => {
  const reponses: ((v: { saluts: number; salue: boolean }) => void)[] = []
  api.saluer.mockImplementation(() => new Promise((r) => reponses.push(r)))
  const { client, saluer } = monter()
  act(() => {
    saluer(LIGNE.id)
    saluer(LIGNE.id)
    saluer(LIGNE.id)
  })
  await waitFor(() => {
    expect(client.getQueryData(CLE)).toEqual([{ ...LIGNE, saluts: 5, salue: true }])
  })
  // Une réponse arrive en pleine rafale : le compteur ne redescend pas, rien ne se relit.
  act(() => {
    reponses[0]?.({ saluts: 3, salue: true })
  })
  await waitFor(() => {
    expect(api.saluer).toHaveBeenCalledTimes(3)
  })
  expect(client.getQueryData(CLE)).toEqual([{ ...LIGNE, saluts: 5, salue: true }])
  expect(client.getQueryState(CLE)?.isInvalidated).toBe(false)
  // Chaque réponse arrive à son heure, comme sur le réseau.
  await act(async () => {
    reponses[1]?.({ saluts: 4, salue: true })
    await Promise.resolve()
  })
  expect(client.getQueryState(CLE)?.isInvalidated).toBe(false)
  act(() => {
    reponses[2]?.({ saluts: 5, salue: true })
  })
  await waitFor(() => {
    expect(client.getQueryState(CLE)?.isInvalidated).toBe(true)
  })
})

test('un refus de la base : le fil se relit', async () => {
  api.saluer.mockRejectedValue(new Error('refus'))
  const { client, saluer } = monter()
  act(() => {
    saluer(LIGNE.id)
  })
  await waitFor(() => {
    expect(client.getQueryState(CLE)?.isInvalidated).toBe(true)
  })
})

test('saluer un ajout, c’est aimer le lieu : ses cœurs de fiche se relisent aussi', async () => {
  api.saluer.mockResolvedValue({ saluts: 3, salue: true })
  const { client, saluer } = monter()
  const FICHE = ['lieu', 'l3', 'coeurs']
  client.setQueryData(FICHE, { total: 2, miens: 0, qui: [] })
  act(() => {
    saluer('ajout:l3')
  })
  await waitFor(() => {
    expect(client.getQueryState(FICHE)?.isInvalidated).toBe(true)
  })
})
