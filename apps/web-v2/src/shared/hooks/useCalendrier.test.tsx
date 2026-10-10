/**
 * QUOI     — le calendrier lu (chrétien tant qu'on ne sait pas), et le choix qui s'affiche tout
 *            de suite.
 * POURQUOI — toutes les dates de l'appli lisent ce hook : il doit tenir sans compte et se
 *            mettre à jour d'un coup.
 * ATTENTION — l'accès à la base est simulé ; on ne teste ici que le hook.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { useCalendrier, useChoisirCalendrier } from './useCalendrier'

const api = vi.hoisted(() => ({ lireCalendrier: vi.fn(), reglerCalendrier: vi.fn() }))
vi.mock('../lib/calendrierDuCompte', () => api)

function enveloppe() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

test('illisible (sans compte, réponse vide) : chrétien', async () => {
  api.lireCalendrier.mockRejectedValue(new Error('objet attendu'))
  const { result } = renderHook(() => useCalendrier(), { wrapper: enveloppe() })
  expect(result.current).toBe('chretien')
  await waitFor(() => {
    expect(api.lireCalendrier).toHaveBeenCalled()
  })
  expect(result.current).toBe('chretien')
})

test('choisir Rome : toutes les dates le lisent aussitôt', async () => {
  api.lireCalendrier.mockResolvedValue('chretien')
  api.reglerCalendrier.mockResolvedValue(undefined)
  const { result } = renderHook(() => ({ lu: useCalendrier(), ...useChoisirCalendrier() }), {
    wrapper: enveloppe(),
  })
  await waitFor(() => {
    expect(api.lireCalendrier).toHaveBeenCalled()
  })
  api.lireCalendrier.mockResolvedValue('rome')
  act(() => {
    result.current.choisir('rome')
  })
  await waitFor(() => {
    expect(result.current.lu).toBe('rome')
  })
  expect(api.reglerCalendrier.mock.calls[0]?.[0]).toBe('rome')
})
