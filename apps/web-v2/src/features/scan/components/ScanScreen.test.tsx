/**
 * QUOI     — l'écran du scanner : le bouton « Scanner » quand le son n'est pas débloqué (arrivée par
 *            un QR), la visée, le bip qui mène au Récit, le conseil, la caméra refusée, l'échec ; le
 *            rescan d'un motif connu et ses choix sur la caméra.
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const etat = vi.hoisted(() => ({
  son: true,
  camera: 'en-marche',
  analyse: {
    pret: true,
    erreur: false,
    meilleur: null as { fragment: number; ressemblance: number } | null,
    empreinteActuelle: () => null,
  },
  empreintes: {
    fragments: [] as { id: number; nom: string; illustration: string | null; empreintes: [] }[],
    erreur: false,
  },
  surBip: null as ((f: number) => void) | null,
  connecte: true,
}))
const noterScan = vi.hoisted(() => vi.fn(() => Promise.resolve()))
type Offre = { porte: boolean; restantes: number; gratuiteDuJour: boolean } | null
const fetchRescan = vi.hoisted(() => vi.fn(() => Promise.resolve<Offre>(null)))
const debloquerSon = vi.hoisted(() =>
  vi.fn(() => {
    etat.son = true
  }),
)
vi.mock('@/shared/lib/son', () => ({ sonDebloque: () => etat.son, debloquerSon, biper: vi.fn() }))
vi.mock('../hooks/useCamera', () => ({
  useCamera: (_v: unknown, actif: boolean) => (actif ? etat.camera : 'attente'),
}))
vi.mock('../hooks/useAnalyse', () => ({
  useAnalyse: (_v: unknown, _r: unknown, _a: boolean, surBip: (f: number) => void) => {
    etat.surBip = surBip
    return etat.analyse
  },
}))
vi.mock('../hooks/useEmpreintes', () => ({
  useEmpreintes: () => etat.empreintes,
  useFragmentsVisibles: () => ({ fragments: [], erreur: false }),
}))
vi.mock('../api/scan', () => ({ noterScan, fetchRescan }))
const feuille = vi.hoisted(() => ({ suggestion: undefined as number | null | undefined }))
vi.mock('./FeuilleApprendre', () => ({
  FeuilleApprendre: ({ suggestion }: { suggestion: number | null }) => {
    feuille.suggestion = suggestion
    return <section aria-label="Apprendre cette vue" />
  },
}))

import { ScanScreen } from './ScanScreen'
import type { Apprendre } from '../api/scan'

function Retour() {
  const navigate = useNavigate()
  const etatRecu: unknown = useLocation().state
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void navigate(-1)
        }}
      >
        Récit membre
      </button>
      <p data-testid="arrivee">{JSON.stringify(etatRecu)}</p>
    </>
  )
}

const client = new QueryClient()

function ouvrir(apprendre: Apprendre = 'non') {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/avant', '/scan']} initialIndex={1}>
        <Routes>
          <Route
            path="/scan"
            element={<ScanScreen connecte={etat.connecte} apprendre={apprendre} />}
          />
          <Route path="/avant" element={<p>Avant le scan</p>} />
          <Route path="/codex/fragment/:id" element={<Retour />} />
          <Route path="/codex/fragment/:id/histoire" element={<p>Son histoire</p>} />
          <Route path="/scan/fragment/:id" element={<p>Récit visiteur</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// Le bip, puis le temps de dire « Ce n'est pas lui » : le scan se note ensuite.
async function biperEtNoter() {
  await act(() => Promise.resolve(etat.surBip?.(11)))
  await act(async () => {
    vi.advanceTimersByTime(1500)
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  Object.assign(etat, { son: true, camera: 'en-marche', connecte: true })
  etat.analyse = { pret: true, erreur: false, meilleur: null, empreinteActuelle: () => null }
  etat.empreintes = {
    fragments: [{ id: 11, nom: 'Hoplite', illustration: null, empreintes: [] }],
    erreur: false,
  }
})
afterEach(() => {
  vi.useRealTimers()
})

test('sans son débloqué (arrivée par un QR), le bouton « Scanner » d’abord, et pas de caméra', async () => {
  etat.son = false
  ouvrir()
  expect(screen.getByRole('button', { name: 'Scanner' })).toBeInTheDocument()
  expect(screen.queryByText('Vise le motif, de près. Ça bipe tout seul.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Scanner' }))
  expect(debloquerSon).toHaveBeenCalled()
  expect(screen.getByText('Vise le motif, de près. Ça bipe tout seul.')).toBeInTheDocument()
})

test('le bip montre le Fragment, note le scan, puis ouvre son Récit dans l’appli', async () => {
  ouvrir()
  // Asynchrone : le scan noté (une promesse) ouvre la fiche.
  await biperEtNoter()
  expect(screen.getByText('Fragment reconnu')).toBeInTheDocument()
  expect(screen.getByText('Hoplite')).toBeInTheDocument()
  expect(noterScan).toHaveBeenCalledWith(11)
  act(() => {
    vi.advanceTimersByTime(600)
  })
  expect(screen.getByText('Récit membre')).toBeInTheDocument()
})

test('tant que le scan n’est pas noté, la fiche attend', () => {
  noterScan.mockReturnValueOnce(new Promise(() => undefined))
  ouvrir()
  act(() => {
    etat.surBip?.(11)
  })
  act(() => {
    vi.advanceTimersByTime(5000)
  })
  expect(screen.queryByText('Récit membre')).toBeNull()
})

test('un visiteur arrive sur le Récit du scan', async () => {
  etat.connecte = false
  ouvrir()
  // Asynchrone : le scan noté (une promesse) ouvre la fiche.
  await biperEtNoter()
  act(() => {
    vi.advanceTimersByTime(600)
  })
  expect(screen.getByText('Récit visiteur')).toBeInTheDocument()
})

test('sans vêtement sous la main : « Découvrir l’appli » dès l’arrivée, vers la vitrine ou l’accueil', () => {
  etat.son = false
  etat.connecte = false
  const { unmount } = ouvrir()
  expect(screen.getByRole('link', { name: 'Découvrir l’appli →' })).toHaveAttribute(
    'href',
    '/bienvenue',
  )
  unmount()
  etat.connecte = true
  ouvrir()
  expect(screen.getByRole('link', { name: 'Découvrir l’appli →' })).toHaveAttribute(
    'href',
    '/accueil',
  )
})

test('un visiteur lit « Aucun compte nécessaire » ; un membre, non', () => {
  etat.connecte = false
  const { unmount } = ouvrir()
  expect(screen.getByText('Aucun compte nécessaire')).toBeInTheDocument()
  unmount()
  etat.connecte = true
  ouvrir()
  expect(screen.queryByText('Aucun compte nécessaire')).not.toBeInTheDocument()
})

test('sans bip au bout de 8 s, le conseil et « Voir tous les Fragments »', () => {
  ouvrir()
  act(() => {
    vi.advanceTimersByTime(8000)
  })
  expect(screen.getByText(/Pas encore reconnu/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Voir tous les Fragments' })).toHaveAttribute(
    'href',
    '/scan/fragments',
  )
})

test('aucune empreinte en base : l’écran s’ouvre, et le conseil vient quand même', () => {
  etat.empreintes = { fragments: [], erreur: false }
  ouvrir()
  act(() => {
    vi.advanceTimersByTime(8000)
  })
  expect(screen.getByText(/Pas encore reconnu/)).toBeInTheDocument()
})

test('la caméra refusée : comment la réautoriser, et la liste', () => {
  etat.camera = 'refusee'
  ouvrir()
  expect(screen.getByText(/caméra/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Voir tous les Fragments' })).toBeInTheDocument()
})

test('le modèle ou les empreintes en échec : un message, pas une attente sans fin', () => {
  etat.analyse = { ...etat.analyse, pret: false, erreur: true }
  ouvrir()
  expect(screen.getByText('Le scan n’a pas pu se préparer.')).toBeInTheDocument()
  etat.analyse = { ...etat.analyse, erreur: false }
  etat.empreintes = { fragments: [], erreur: true }
  ouvrir()
  expect(screen.getAllByText('Le scan n’a pas pu se préparer.').length).toBeGreaterThan(0)
})

test('un Porteur voit « Apprendre cette vue » ; un joueur sans Fragment, non', () => {
  const { unmount } = ouvrir('porteur')
  expect(screen.getByRole('region', { name: 'Apprendre cette vue' })).toBeInTheDocument()
  unmount()
  ouvrir()
  expect(screen.queryByRole('region', { name: 'Apprendre cette vue' })).not.toBeInTheDocument()
})

test('pendant que le modèle se prépare : « Préparation du scan… », et pas de conseil trompeur', () => {
  etat.analyse = { ...etat.analyse, pret: false }
  ouvrir()
  expect(screen.getByText('Préparation du scan…')).toBeInTheDocument()
  act(() => {
    vi.advanceTimersByTime(8000)
  })
  expect(screen.queryByText(/Pas encore reconnu/)).not.toBeInTheDocument()
})

test('le Récit remplace le scanner : le retour ramène avant le scan, sans rebiper', async () => {
  ouvrir()
  // Asynchrone : le scan noté (une promesse) ouvre la fiche.
  await biperEtNoter()
  act(() => {
    vi.advanceTimersByTime(600)
  })
  await userEvent.click(screen.getByRole('button', { name: 'Récit membre' }))
  expect(screen.getByText('Avant le scan')).toBeInTheDocument()
})

test('la feuille ne reçoit une suggestion qu’au-dessus du seuil', () => {
  etat.analyse = { ...etat.analyse, meilleur: { fragment: 11, ressemblance: 0.2 } }
  const { unmount } = ouvrir('admin')
  expect(feuille.suggestion).toBeNull()
  unmount()
  etat.analyse = { ...etat.analyse, meilleur: { fragment: 11, ressemblance: 0.8 } }
  ouvrir('admin')
  expect(feuille.suggestion).toBe(11)
})

test('un scan noté fait relire le Codex et la fiche du Fragment', async () => {
  const relire = vi.spyOn(client, 'invalidateQueries')
  ouvrir()
  // Asynchrone : le scan noté (une promesse) ouvre la fiche.
  await biperEtNoter()
  await vi.waitFor(() => {
    expect(relire).toHaveBeenCalledWith({ queryKey: ['codex'] })
  })
  expect(relire).toHaveBeenCalledWith({ queryKey: ['mon-fragment', 11] })
})

test('rescan d’un motif connu, la gratuite du jour à prendre : les choix sur la caméra', async () => {
  fetchRescan.mockResolvedValueOnce({ porte: false, restantes: 4, gratuiteDuJour: true })
  ouvrir()
  await biperEtNoter()
  await act(() => Promise.resolve())
  expect(screen.getByText('Tu le connais · 4 anecdotes à découvrir')).toBeInTheDocument()
  act(() => {
    vi.advanceTimersByTime(5000)
  })
  expect(screen.queryByText('Récit membre')).toBeNull() // pas de bip qui emmène ailleurs
  await userEvent.click(screen.getByRole('button', { name: /Découvrir l’anecdote du jour/ }))
  expect(screen.getByTestId('arrivee').textContent).toContain('"creuser":false')
})

test('rescan, la gratuite déjà prise, porté : creuser, ou lire son histoire', async () => {
  fetchRescan.mockResolvedValue({ porte: true, restantes: 2, gratuiteDuJour: false })
  ouvrir()
  await biperEtNoter()
  await act(() => Promise.resolve())
  await userEvent.click(screen.getByRole('button', { name: /Creuser une anecdote/ }))
  expect(screen.getByTestId('arrivee').textContent).toContain('"creuser":true')
  fetchRescan.mockResolvedValue(null)
})

test('rescan d’un Fragment porté : « Lire son histoire » ouvre son histoire', async () => {
  fetchRescan.mockResolvedValueOnce({ porte: true, restantes: 0, gratuiteDuJour: true })
  ouvrir()
  await biperEtNoter()
  await act(() => Promise.resolve())
  expect(screen.queryByRole('button', { name: /anecdote/ })).toBeNull() // tout est trouvé
  await userEvent.click(screen.getByRole('button', { name: /Lire son histoire/ }))
  expect(screen.getByText('Son histoire')).toBeInTheDocument()
})

test('le scan a confondu deux motifs : « Viser encore » relance la visée', async () => {
  fetchRescan.mockResolvedValueOnce({ porte: false, restantes: 4, gratuiteDuJour: true })
  ouvrir()
  await biperEtNoter()
  await act(() => Promise.resolve())
  await userEvent.click(screen.getByRole('button', { name: /Viser encore/ }))
  expect(screen.queryByRole('button', { name: /anecdote/ })).toBeNull()
  expect(screen.getByText('Vise le motif, de près. Ça bipe tout seul.')).toBeInTheDocument()
  // Le motif écarté ne rebipe pas : on a le temps de viser le bon.
  noterScan.mockClear()
  await biperEtNoter()
  expect(noterScan).not.toHaveBeenCalled()
  expect(screen.getByText('Vise le motif, de près. Ça bipe tout seul.')).toBeInTheDocument()
})

test('au premier scan, « Ce n’est pas lui » avant que le scan s’écrive : rien n’est noté', async () => {
  ouvrir()
  await act(() => Promise.resolve(etat.surBip?.(11)))
  expect(screen.getByText('Fragment reconnu')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Ce n’est pas lui/ }))
  act(() => {
    vi.advanceTimersByTime(5000)
  })
  expect(noterScan).not.toHaveBeenCalled()
  expect(screen.queryByText('Récit membre')).toBeNull()
  expect(screen.getByText('Vise le motif, de près. Ça bipe tout seul.')).toBeInTheDocument()
})
