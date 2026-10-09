/**
 * QUOI     — l'écran du scanner : le bouton « Scanner » quand le son n'est pas débloqué (arrivée par
 *            un QR), la visée, le bip qui mène au Récit, le conseil, la caméra refusée, l'échec.
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
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
const noterScan = vi.hoisted(() => vi.fn())
const debloquerSon = vi.hoisted(() =>
  vi.fn(() => {
    etat.son = true
  }),
)
vi.mock('../lib/son', () => ({ sonDebloque: () => etat.son, debloquerSon, biper: vi.fn() }))
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
vi.mock('../api/scan', () => ({ noterScan }))
const feuille = vi.hoisted(() => ({ suggestion: undefined as number | null | undefined }))
vi.mock('./FeuilleApprendre', () => ({
  FeuilleApprendre: ({ suggestion }: { suggestion: number | null }) => {
    feuille.suggestion = suggestion
    return <section aria-label="Apprendre cette vue" />
  },
}))

import { ScanScreen } from './ScanScreen'

function Retour() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => {
        void navigate(-1)
      }}
    >
      Récit membre
    </button>
  )
}

function ouvrir(admin = false) {
  return render(
    <MemoryRouter initialEntries={['/avant', '/scan']} initialIndex={1}>
      <Routes>
        <Route path="/scan" element={<ScanScreen connecte={etat.connecte} admin={admin} />} />
        <Route path="/avant" element={<p>Avant le scan</p>} />
        <Route path="/accueil/fragment/:id" element={<Retour />} />
        <Route path="/scan/fragment/:id" element={<p>Récit visiteur</p>} />
      </Routes>
    </MemoryRouter>,
  )
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

test('le bip montre le Fragment, note le scan, puis ouvre son Récit dans l’appli', () => {
  ouvrir()
  act(() => {
    etat.surBip?.(11)
  })
  expect(screen.getByText('Fragment reconnu')).toBeInTheDocument()
  expect(screen.getByText('Hoplite')).toBeInTheDocument()
  expect(noterScan).toHaveBeenCalledWith(11)
  act(() => {
    vi.advanceTimersByTime(600)
  })
  expect(screen.getByText('Récit membre')).toBeInTheDocument()
})

test('un visiteur arrive sur le Récit du scan', () => {
  etat.connecte = false
  ouvrir()
  act(() => {
    etat.surBip?.(11)
  })
  act(() => {
    vi.advanceTimersByTime(600)
  })
  expect(screen.getByText('Récit visiteur')).toBeInTheDocument()
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

test('un admin voit « Apprendre cette vue » ; un joueur, non', () => {
  const { unmount } = ouvrir(true)
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
  act(() => {
    etat.surBip?.(11)
  })
  act(() => {
    vi.advanceTimersByTime(600)
  })
  await userEvent.click(screen.getByRole('button', { name: 'Récit membre' }))
  expect(screen.getByText('Avant le scan')).toBeInTheDocument()
})

test('la feuille des admins ne reçoit une suggestion qu’au-dessus du seuil', () => {
  etat.analyse = { ...etat.analyse, meilleur: { fragment: 11, ressemblance: 0.2 } }
  const { unmount } = ouvrir(true)
  expect(feuille.suggestion).toBeNull()
  unmount()
  etat.analyse = { ...etat.analyse, meilleur: { fragment: 11, ressemblance: 0.8 } }
  ouvrir(true)
  expect(feuille.suggestion).toBe(11)
})
