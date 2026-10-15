import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { TiroirCulture } from './TiroirCulture'

const mockRpc = vi.hoisted(() => vi.fn())
const mockEnvoyer = vi.hoisted(() => vi.fn())
vi.mock('@/shared/lib/envoi', async (orig) => ({ ...(await orig<typeof import('@/shared/lib/envoi')>()), envoyerFichier: mockEnvoyer }))
vi.mock('@/shared/supabase/client', () => ({ supabase: { rpc: mockRpc } }))

const fiche = {
  id: 'nordique', label: 'Nordique', couleur: '#aa0000', icone: null, complement: null, zone: null, presentation: null,
  cercles: [{ lat: 60, lng: 10, rayon_km: 300 }], active: true, ordre: 2, stock: 10, total: 40, eveils: [],
}

function monter(adresse = '/jeu/cultures/nordique') {
  mockRpc.mockImplementation((nom: string) =>
    Promise.resolve(nom === 'cultures_du_hub' ? { data: [fiche], error: null } : { data: null, error: null }))
  const router = createMemoryRouter([{ path: '/jeu/cultures', children: [{ path: ':id', Component: TiroirCulture }] }], { initialEntries: [adresse] })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>)
}

beforeEach(() => { vi.clearAllMocks() })

test('une culture active sans aucun cercle : le message, rien n’est envoyé', async () => {
  monter()
  await userEvent.click(await screen.findByRole('button', { name: 'Retirer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Une culture active doit s’éveiller quelque part : ajoute au moins un cercle.')
  expect(mockRpc).not.toHaveBeenCalledWith('enregistrer_culture', expect.anything())
})

test('enregistrer_culture reçoit les bons arguments : chaînes vides pour les champs vides, ordre conservé', async () => {
  monter()
  await userEvent.type(await screen.findByLabelText('Où elle s’éveille'), 'Au nord')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByText('Enregistré.')).toBeInTheDocument()
  expect(mockRpc).toHaveBeenCalledWith('enregistrer_culture', {
    p_id: 'nordique', p_label: 'Nordique', p_couleur: '#aa0000', p_icone: '', p_complement: '',
    p_cercles: [{ lat: 60, lng: 10, rayon_km: 300 }], p_active: true, p_ordre: 2, p_zone: 'Au nord', p_presentation: '',
  })
})

test('une icône d’un type refusé : le message reste affiché, rien n’est envoyé', async () => {
  monter()
  const champ = await screen.findByLabelText('Icône')
  await userEvent.upload(champ, new File(['x'], 'a.gif', { type: 'image/gif' }), { applyAccept: false })
  expect(await screen.findByRole('alert')).toHaveTextContent('Ce type de fichier n’est pas accepté')
  expect(mockEnvoyer).not.toHaveBeenCalled()
})

test('le refus de la base s’affiche', async () => {
  monter()
  await screen.findByLabelText('Nom')
  mockRpc.mockImplementation((nom: string) =>
    Promise.resolve(nom === 'enregistrer_culture' ? { data: null, error: { message: 'Cercle invalide' } } : { data: [fiche], error: null }))
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Cercle invalide')
})

test('une culture inconnue : introuvable', async () => {
  monter('/jeu/cultures/autre')
  expect(await screen.findByText('Culture introuvable.')).toBeInTheDocument()
})
