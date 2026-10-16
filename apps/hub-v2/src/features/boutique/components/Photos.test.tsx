import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { vi } from 'vitest'
import type { Contribution, ListeContributions } from '../api/contributions'
import { Photos } from './Photos'

const api = vi.hoisted(() => ({
  lireContributions: vi.fn(),
  lireEtiquettes: vi.fn(),
  modererContribution: vi.fn(),
  modifierMessage: vi.fn(),
  ajouterEtiquette: vi.fn(),
  retirerEtiquette: vi.fn(),
  creerEtiquette: vi.fn(),
  supprimerContribution: vi.fn(),
  supprimerPhoto: vi.fn(),
  montrerAuMur: vi.fn(),
  montrerDansCommunaute: vi.fn(),
  relierProduit: vi.fn(),
  delierProduit: vi.fn(),
  mettreSurLaFiche: vi.fn(),
}))
vi.mock('../api/contributions', () => api)

const photo = (id: string, url = `https://x/${id}.jpg`) => ({
  id, url, chemin: null, taille: 'M', produit_id: null, produit_handle: null, produit_titre: null,
  media: null, communaute: false, mur: false,
})
const contribution = (id: string, nom: string, surcharge: Partial<Contribution> = {}): Contribution => ({
  id, quand: '2026-10-10T10:00:00Z', statut: 'pending', nom, email: `${nom.toLowerCase()}@x.fr`, instagram: '@brune',
  role: 'client', compte: null, lieu: 'Lyon', code_postal: '69001', departement: 'Rhône', message: 'Superbe veste',
  note_equipe: null, taille: 'M', produit: 'Veste Hoplite', hauteur: 168, epaules: 40, note_experience: 4, note_produits: 5,
  diffusion: true, recompensee_le: null, images: [photo(`${id}a`), photo(`${id}b`, 'https://x/clip.mp4')], etiquettes: [], ...surcharge,
})
const liste = (lignes: Contribution[]): ListeContributions => ({
  total: lignes.length,
  compteurs: { a_valider: 12, publiees: 340, archivees: 8, au_mur: 57, plus_ancienne: '2026-10-07T10:00:00Z' },
  lignes,
})

beforeEach(() => {
  vi.clearAllMocks()
  api.lireEtiquettes.mockResolvedValue([{ id: 't1', nom: 'veste' }, { id: 't2', nom: 'hiver' }])
  for (const f of [api.modererContribution, api.modifierMessage, api.ajouterEtiquette, api.retirerEtiquette, api.supprimerContribution]) f.mockResolvedValue(undefined)
  api.creerEtiquette.mockResolvedValue('t3')
})

function Adresse() {
  return <p data-testid="adresse">{useLocation().search}</p>
}
function afficher(lignes: Contribution[], adresse = '/boutique/photos') {
  api.lireContributions.mockResolvedValue(liste(lignes))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalider = vi.spyOn(client, 'invalidateQueries')
  const router = createMemoryRouter(
    [{ path: '/boutique/photos', element: <><Photos /><Adresse /></> }],
    { initialEntries: [adresse] },
  )
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
  return invalider
}

test('la file est filtrée sur « À valider » et la première contribution est choisie', async () => {
  afficher([contribution('c1', 'Brune'), contribution('c2', 'Corentin')])
  expect(await screen.findByRole('heading', { name: 'Brune' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'À valider' })).toBeChecked()
  expect(api.lireContributions).toHaveBeenCalledWith({ filtre: 'pending', recherche: '', limite: 50, decalage: 0 })
  expect(screen.getByRole('button', { name: /Corentin/ })).toBeInTheDocument()
  expect(screen.getAllByText('2 fichiers · 10/10/2026')).toHaveLength(2)
})

test('les quatre tuiles et la phrase de l’en-tête', async () => {
  afficher([contribution('c1', 'Brune')])
  expect(await screen.findByText('12 contributions attendent ; la plus ancienne est arrivée il y a', { exact: false })).toBeInTheDocument()
  for (const [libelle, valeur] of [['À valider', '12'], ['Publiées', '340'], ['Archivées', '8'], ['Photos au mur', '57']] as const) {
    expect(screen.getByRole('group', { name: 'Les chiffres' })).toHaveTextContent(`${libelle}${valeur}`)
  }
})

test('le client, sa note, son message et ses photos', async () => {
  afficher([contribution('c1', 'Brune')])
  await screen.findByRole('heading', { name: 'Brune' })
  expect(screen.getByText(/^Client · /)).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Média' })[0]).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Veste Hoplite · M')).toBeInTheDocument()
  expect(screen.getByLabelText('Expérience : 4 sur 5')).toHaveTextContent('★★★★☆')
  expect(screen.getByLabelText('Produits : 5 sur 5')).toHaveTextContent('★★★★★')
  expect(screen.getByText('Hauteur : 168 cm · Épaules : 40 cm')).toBeInTheDocument()
  expect(screen.getByText('Superbe veste')).toBeInTheDocument()
})

test('« Valider et publier » verse les couronnes et passe à la suivante', async () => {
  const invalider = afficher([contribution('c1', 'Brune'), contribution('c2', 'Corentin')])
  await screen.findByRole('heading', { name: 'Brune' })
  const champ = screen.getByLabelText('Couronnes offertes')
  expect(champ).toHaveValue(10)
  await userEvent.clear(champ)
  await userEvent.type(champ, '15')
  await userEvent.click(screen.getByRole('button', { name: 'Valider et publier' }))
  await waitFor(() => { expect(api.modererContribution).toHaveBeenCalledWith('c1', 'approved', 15) })
  expect(await screen.findByRole('heading', { name: 'Corentin' })).toBeInTheDocument()
  expect(screen.getByTestId('adresse')).toHaveTextContent('c=c2')
  await waitFor(() => {
    expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-contributions'] })
    expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-ouverture'] })
  })
})

test('une contribution déjà récompensée n’a pas de champ de couronnes', async () => {
  afficher([contribution('c1', 'Brune', { recompensee_le: '2026-10-05T10:00:00Z' })])
  await screen.findByRole('heading', { name: 'Brune' })
  expect(screen.queryByLabelText('Couronnes offertes')).not.toBeInTheDocument()
  expect(screen.getByText('Déjà récompensée le 05/10/2026')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Valider et publier' }))
  await waitFor(() => { expect(api.modererContribution).toHaveBeenCalledWith('c1', 'approved') })
})

test('« Archiver » archive, sans couronnes', async () => {
  afficher([contribution('c1', 'Brune')])
  await userEvent.click(await screen.findByRole('button', { name: 'Archiver' }))
  await waitFor(() => { expect(api.modererContribution).toHaveBeenCalledWith('c1', 'archived') })
})

test('une contribution publiée s’archive mais ne se valide plus', async () => {
  afficher([contribution('c1', 'Brune', { statut: 'approved' })], '/boutique/photos?filtre=approved')
  await screen.findByRole('heading', { name: 'Brune' })
  expect(screen.getByRole('button', { name: 'Archiver' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Valider et publier' })).not.toBeInTheDocument()
})

test('le refus de la base s’affiche', async () => {
  api.modererContribution.mockRejectedValue(new Error('Réservé à l’équipe'))
  afficher([contribution('c1', 'Brune')])
  await userEvent.click(await screen.findByRole('button', { name: 'Archiver' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Réservé à l’équipe')
})

test('le filtre et la recherche sont dans l’adresse', async () => {
  afficher([contribution('c1', 'Brune')], '/boutique/photos?filtre=approved&q=brune')
  await screen.findByRole('heading', { name: 'Brune' })
  expect(api.lireContributions).toHaveBeenCalledWith({ filtre: 'approved', recherche: 'brune', limite: 50, decalage: 0 })
  expect(screen.getByRole('radio', { name: 'Publiées' })).toBeChecked()
  expect(screen.getByRole('searchbox', { name: 'Un nom, un e-mail…' })).toHaveValue('brune')
  await userEvent.click(screen.getByRole('radio', { name: 'Toutes' }))
  expect(screen.getByTestId('adresse')).toHaveTextContent('filtre=toutes')
})

test('le message se corrige', async () => {
  afficher([contribution('c1', 'Brune')])
  await screen.findByRole('heading', { name: 'Brune' })
  await userEvent.click(screen.getByRole('button', { name: 'Modifier' }))
  const zone = screen.getByRole('textbox', { name: 'Message' })
  expect(zone).toHaveAttribute('maxlength', '500')
  await userEvent.clear(zone)
  await userEvent.type(zone, 'Corrigé')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => { expect(api.modifierMessage).toHaveBeenCalledWith('c1', 'Corrigé') })
})

test('les étiquettes : poser, retirer, créer', async () => {
  afficher([contribution('c1', 'Brune', { etiquettes: [{ id: 't1', nom: 'veste' }] })])
  await screen.findByRole('heading', { name: 'Brune' })
  expect(screen.getByText('#veste')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retirer #veste' }))
  await waitFor(() => { expect(api.retirerEtiquette).toHaveBeenCalledWith('c1', 't1') })

  await userEvent.click(screen.getByRole('button', { name: '+ ajouter' }))
  await screen.findByRole('option', { name: '#hiver' })
  expect(screen.queryByRole('option', { name: '#veste' })).not.toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Ajouter une étiquette'), '#hiver')
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
  await waitFor(() => { expect(api.ajouterEtiquette).toHaveBeenCalledWith('c1', 't2') })

  await userEvent.click(screen.getByRole('button', { name: '+ Nouvelle étiquette' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Nouvelle étiquette' }), 'Été')
  await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
  await waitFor(() => {
    expect(api.creerEtiquette).toHaveBeenCalledWith('Été')
    expect(api.ajouterEtiquette).toHaveBeenCalledWith('c1', 't3')
  })
})

test('file vide', async () => {
  afficher([])
  expect(await screen.findByText('Aucune contribution ici.')).toBeInTheDocument()
})

test('la contribution de l’adresse (?c=) est choisie', async () => {
  afficher([contribution('c1', 'Brune'), contribution('c2', 'Corentin')], '/boutique/photos?c=c2')
  expect(await screen.findByRole('heading', { name: 'Corentin' })).toBeInTheDocument()
})

describe('après une décision', () => {
  const trois = () => [contribution('c1', 'Brune'), contribution('c2', 'Corentin'), contribution('c3', 'Dana')]

  test('celle du milieu : la suivante, même si la relecture l’a retirée', async () => {
    afficher(trois(), '/boutique/photos?c=c2')
    await screen.findByRole('heading', { name: 'Corentin' })
    api.lireContributions.mockResolvedValue(liste([contribution('c1', 'Brune'), contribution('c3', 'Dana')]))
    await userEvent.click(screen.getByRole('button', { name: 'Valider et publier' }))
    expect(await screen.findByRole('heading', { name: 'Dana' })).toBeInTheDocument()
    expect(screen.getByTestId('adresse')).toHaveTextContent('c=c3')
  })

  test('la dernière : celle d’avant', async () => {
    afficher(trois(), '/boutique/photos?c=c3')
    await screen.findByRole('heading', { name: 'Dana' })
    api.lireContributions.mockResolvedValue(liste([contribution('c1', 'Brune'), contribution('c2', 'Corentin')]))
    await userEvent.click(screen.getByRole('button', { name: 'Valider et publier' }))
    expect(await screen.findByRole('heading', { name: 'Corentin' })).toBeInTheDocument()
    expect(screen.getByTestId('adresse')).toHaveTextContent('c=c2')
  })

  test('« Archiver » passe aussi à la suivante', async () => {
    afficher(trois(), '/boutique/photos?c=c2')
    await screen.findByRole('heading', { name: 'Corentin' })
    api.lireContributions.mockResolvedValue(liste([contribution('c1', 'Brune'), contribution('c3', 'Dana')]))
    await userEvent.click(screen.getByRole('button', { name: 'Archiver' }))
    expect(await screen.findByRole('heading', { name: 'Dana' })).toBeInTheDocument()
    expect(screen.getByTestId('adresse')).toHaveTextContent('c=c3')
  })
})

test('un nouvel essai efface l’erreur du précédent', async () => {
  api.modererContribution.mockRejectedValueOnce(new Error('Réservé à l’équipe'))
  afficher([contribution('c1', 'Brune')])
  await userEvent.click(await screen.findByRole('button', { name: 'Archiver' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Réservé à l’équipe')
  await userEvent.click(screen.getByRole('button', { name: 'Archiver' }))
  await waitFor(() => { expect(screen.queryByRole('alert')).not.toBeInTheDocument() })
  expect(api.modererContribution).toHaveBeenCalledTimes(2)
})

describe('supprimer une contribution', () => {
  test('la confirmation compte les photos, puis « Confirmer » supprime et passe à la suivante', async () => {
    afficher([contribution('c1', 'Brune'), contribution('c2', 'Corentin')])
    await screen.findByRole('heading', { name: 'Brune' })
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(screen.getByText('Supprimer cette contribution et ses 2 photos ?')).toBeInTheDocument()
    expect(api.supprimerContribution).not.toHaveBeenCalled()
    api.lireContributions.mockResolvedValue(liste([contribution('c2', 'Corentin')]))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => { expect(api.supprimerContribution).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' })) })
    expect(await screen.findByRole('heading', { name: 'Corentin' })).toBeInTheDocument()
    expect(screen.getByTestId('adresse')).toHaveTextContent('c=c2')
  })

  test('« Annuler » referme la confirmation sans rien supprimer', async () => {
    afficher([contribution('c1', 'Brune')])
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByText(/Supprimer cette contribution/)).not.toBeInTheDocument()
    expect(api.supprimerContribution).not.toHaveBeenCalled()
  })

  test('si la suppression échoue, le message s’affiche et la contribution reste', async () => {
    api.supprimerContribution.mockRejectedValue(new Error('Suppression image: HTTP 500'))
    afficher([contribution('c1', 'Brune'), contribution('c2', 'Corentin')])
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Suppression image: HTTP 500')
    expect(screen.getByRole('heading', { name: 'Brune' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Corentin/ })).toBeInTheDocument()
    expect(screen.getByTestId('adresse')).not.toHaveTextContent('c=c2')
  })
})

describe('télécharger depuis une date', () => {
  test('les contributions de la page créées depuis la date, comptées', async () => {
    afficher([
      contribution('c1', 'Brune', { quand: '2026-10-10T10:00:00Z' }),
      contribution('c2', 'Corentin', { quand: '2026-09-01T10:00:00Z' }),
    ])
    await screen.findByRole('heading', { name: 'Brune' })
    expect(screen.getByRole('button', { name: /Télécharger \(\.zip\)/ })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Télécharger depuis le'), { target: { value: '2026-10-01' } })
    expect(screen.getByRole('button', { name: /Télécharger \(\.zip\)/ })).toBeEnabled()
    expect(screen.getByText('1 contribution · 2 fichiers')).toBeInTheDocument()
  })
})
