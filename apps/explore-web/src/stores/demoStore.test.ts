import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDemoStore } from './demoStore'

describe('demoStore', () => {
  beforeEach(() => { useDemoStore.getState().resetJournee() })

  it('starts fresh: full energy, Glory 0, 0 discovered, infinite Crowns', () => {
    const s = useDemoStore.getState()
    expect(s.energy).toBe(s.maxEnergy)
    expect(s.glory).toBe(0)
    expect(s.discoveredIds).toHaveLength(0)
    expect(s.crownsBalance).toBe(Infinity)
  })

  it('addDiscovered adds id without touching energy', () => {
    useDemoStore.getState().addDiscovered('place-1')
    const s = useDemoStore.getState()
    expect(s.discoveredIds).toContain('place-1')
    expect(s.energy).toBe(s.maxEnergy)
  })

  it('addDiscovered reste idempotent : le compteur du jour ne double pas', () => {
    useDemoStore.getState().addDiscovered('place-1')
    useDemoStore.getState().addDiscovered('place-1')
    expect(useDemoStore.getState().discoveredIds).toEqual(['place-1'])
  })

  it('addGlory accumulates', () => {
    useDemoStore.getState().addGlory(1)
    useDemoStore.getState().addGlory(2)
    expect(useDemoStore.getState().glory).toBe(3)
  })
})

// Deux remises à zéro distinctes : le passage d'un visiteur au suivant ne doit
// PAS effacer la mémoire de la journée — c'est tout l'intérêt de la borne au
// festival. Seul le geste caché d'Uriel efface les lieux.
describe('demoStore — mémoire de la journée', () => {
  beforeEach(() => { useDemoStore.getState().resetJournee() })

  it('reset() (visiteur suivant) garde les lieux mais repart de zéro sur la session', () => {
    useDemoStore.getState().addDiscovered('p1')
    useDemoStore.getState().addDiscovered('p2')
    useDemoStore.getState().addGlory(5)

    useDemoStore.getState().reset()

    const s = useDemoStore.getState()
    expect(s.discoveredIds).toEqual(['p1', 'p2'])
    expect(s.glory).toBe(0)
    expect(s.energy).toBe(s.maxEnergy)
    expect(s.crownsBalance).toBe(Infinity)
  })

  it('resetJournee() (geste caché) efface aussi les lieux', () => {
    useDemoStore.getState().addDiscovered('p1')
    useDemoStore.getState().addGlory(5)

    useDemoStore.getState().resetJournee()

    const s = useDemoStore.getState()
    expect(s.discoveredIds).toHaveLength(0)
    expect(s.glory).toBe(0)
  })

  it('les lieux survivent à une succession de visiteurs', () => {
    useDemoStore.getState().addDiscovered('p1')
    useDemoStore.getState().reset()
    useDemoStore.getState().addDiscovered('p2')
    useDemoStore.getState().reset()
    useDemoStore.getState().addDiscovered('p3')

    expect(useDemoStore.getState().discoveredIds).toEqual(['p1', 'p2', 'p3'])
  })
})

describe('demoStore — persistance', () => {
  it('ne persiste que les lieux, jamais la session du visiteur', () => {
    useDemoStore.getState().resetJournee()
    useDemoStore.getState().addDiscovered('p1')
    useDemoStore.getState().addGlory(7)

    const persisted = useDemoStore.persist.getOptions().partialize?.(useDemoStore.getState())

    expect(persisted).toEqual({ discoveredIds: ['p1'] })
  })

  // La borne recharge la page toutes les 3 min : la mémoire du jour ne vaut
  // rien si elle ne survit pas à un redémarrage du module.
  it('les lieux survivent à un rechargement de la borne', async () => {
    const disque = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => disque.get(k) ?? null,
      setItem: (k: string, v: string) => { disque.set(k, v) },
      removeItem: (k: string) => { disque.delete(k) },
    })

    vi.resetModules()
    const avant = (await import('./demoStore')).useDemoStore
    avant.getState().resetJournee()
    avant.getState().addDiscovered('p1')
    avant.getState().addDiscovered('p2')

    // Rechargement : le module repart de zéro, seul le disque subsiste.
    vi.resetModules()
    const apres = (await import('./demoStore')).useDemoStore

    expect(apres.getState().discoveredIds).toEqual(['p1', 'p2'])
    vi.unstubAllGlobals()
  })
})
