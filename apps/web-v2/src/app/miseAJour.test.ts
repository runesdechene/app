import { afterEach, expect, it, vi } from 'vitest'

vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn() }))
vi.mock('@/shared/supabase/client', () => ({ supabase: {} }))

afterEach(() => {
  vi.unstubAllGlobals()
})

// Désinscrire le service worker efface l'abonnement aux notifications de ce téléphone.
it('une version forcée relance le service worker sans le désinscrire', async () => {
  const inscription = { update: vi.fn(() => Promise.resolve()), unregister: vi.fn() }
  vi.stubGlobal('caches', { keys: () => Promise.resolve([]), delete: vi.fn() })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: () => Promise.resolve(inscription),
      getRegistrations: () => Promise.resolve([inscription]),
    },
  })
  const reload = vi.fn()
  vi.stubGlobal('location', { reload })
  const { recharger, signalerNouvelleVersion } = await import('./miseAJour')

  signalerNouvelleVersion('forcee')
  await recharger()

  expect(inscription.unregister).not.toHaveBeenCalled()
  expect(inscription.update).toHaveBeenCalled()
  expect(reload).toHaveBeenCalled()
})
