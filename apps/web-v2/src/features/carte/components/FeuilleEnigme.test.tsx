/**
 * QUOI     — la feuille d'une énigme : la question, une seule réponse, le verdict, l'erreur.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { FeuilleEnigme } from './FeuilleEnigme'

const ouvrirEnigme = vi.fn<(id: number) => Promise<unknown>>()
const percerEnigme = vi.fn<(id: number, r: string) => Promise<unknown>>()
vi.mock('../api/enigmes', () => ({
  ouvrirEnigme: (id: number) => ouvrirEnigme(id),
  percerEnigme: (id: number, r: string) => percerEnigme(id, r),
}))

const onFermer = vi.fn()

function monter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <FeuilleEnigme touchee={{ id: 4, x: 100, y: 200 }} onFermer={onFermer} />
    </QueryClientProvider>,
  )
}

// jsdom n'anime rien : une fois l'énigme chargée (le sceau porte `data-retourne`), la fin du
// retournement se déclenche à la main.
async function retourner() {
  await waitFor(() => {
    expect(document.querySelector('[data-retourne]')).not.toBeNull()
  })
  const sceau = document.querySelector('[data-retourne]')
  if (sceau) fireEvent.animationEnd(sceau)
}

const enigme = {
  culture: { id: 'byzantine', nom: 'Byzance', icone: null, couleur: null },
  recit: 'Justinien voulait bâtir…',
  question: 'Quel monument Justinien a-t-il fait construire ?',
  format: 'qcm',
  choix: ['Sainte-Sophie', 'Sainte-Irène'],
}

test('le sceau retourné, la question et ses réponses ; une réponse juste montre les gains', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  percerEnigme.mockResolvedValue({
    juste: true, reponse: 'Sainte-Sophie', explication: 'La plus grande coupole…', xp: 1, gagnes: 1,
    points: 5, total: 130, nouveauxTitres: ['Apprentie de Byzance'], prochain: { nom: 'Lettrée de Byzance', seuil: 10 },
    resteEnAttente: 2, niveau: { niveau: 12, avant: 0.5, apres: 0.52 },
  })
  monter()
  await retourner()
  fireEvent.click(await screen.findByRole('button', { name: 'Sainte-Sophie' }))
  expect(await screen.findByText('+1 XP')).toBeInTheDocument()
  expect(screen.getByText('La réponse : Sainte-Sophie')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Niveau 12' })).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Byzance' })).toBeInTheDocument()
  expect(percerEnigme).toHaveBeenCalledWith(4, 'Sainte-Sophie')
  expect(screen.getByText('Te voilà Apprentie de Byzance. Il se porte depuis ton profil.')).toBeInTheDocument()
  expect(screen.getByText('La plus grande coupole…')).toBeInTheDocument()
  expect(screen.getByText('Encore 2 énigmes')).toBeInTheDocument()
  expect(screen.getByText('Elles t’attendent sur la carte. Une nouvelle apparaît chaque jour.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retour à la carte' }))
  expect(onFermer).toHaveBeenCalled()
})

test('une énigme rendormie le dit', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  percerEnigme.mockRejectedValue({ code: 'P0002' })
  monter()
  await retourner()
  fireEvent.click(await screen.findByRole('button', { name: 'Sainte-Irène' }))
  expect(await screen.findByText('Cette énigme s’est rendormie.')).toBeInTheDocument()
})

test('deux touchers rapides n’envoient qu’une réponse', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  percerEnigme.mockReturnValue(new Promise(() => undefined))
  monter()
  await retourner()
  const bouton = await screen.findByRole('button', { name: 'Sainte-Sophie' })
  fireEvent.click(bouton)
  fireEvent.click(bouton)
  await waitFor(() => {
    expect(percerEnigme).toHaveBeenCalledTimes(1)
  })
})

test('l’en-tête dit « Énigme » et la culture ; sans icône, le sceau porte son initiale', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  monter()
  await retourner()
  expect(await screen.findByText('Énigme')).toBeInTheDocument()
  expect(screen.getByText('Byzance')).toBeInTheDocument()
  expect(screen.getByTestId('sceau-culture')).toHaveTextContent('B')
})

test('le logo de la culture se peint à sa couleur, jamais en noir', async () => {
  ouvrirEnigme.mockResolvedValue({ ...enigme, culture: { ...enigme.culture, icone: 'https://x/chrisme.svg', couleur: '#a93d76' } })
  monter()
  await retourner()
  const sceau = await screen.findByTestId('sceau-culture')
  expect(sceau.querySelector('img')).toBeNull()
  expect(sceau.querySelector('[style*="--icone"]')?.getAttribute('style')).toContain('https://x/chrisme.svg')
})

test('les réponses portent une lettre, hors de leur nom', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  monter()
  await retourner()
  const bouton = await screen.findByRole('button', { name: 'Sainte-Irène' })
  expect(bouton).toHaveTextContent('B')
})

test('une réponse fausse : pas cette fois, la bonne réponse, et le savais-tu', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  percerEnigme.mockResolvedValue({
    juste: false, reponse: 'Sainte-Sophie', explication: 'La plus grande coupole…', xp: 0, gagnes: 0,
    points: 4, total: 130, nouveauxTitres: [], prochain: { nom: 'Apprentie de Byzance', seuil: 4 },
    resteEnAttente: 2, niveau: { niveau: 12, avant: 0.5, apres: 0.5 },
  })
  monter()
  await retourner()
  fireEvent.click(await screen.findByRole('button', { name: 'Sainte-Irène' }))
  expect(await screen.findByText('Pas cette fois')).toBeInTheDocument()
  expect(screen.getByText('La réponse : Sainte-Sophie')).toBeInTheDocument()
  expect(screen.getByText('La plus grande coupole…')).toBeInTheDocument()
  expect(screen.queryByText('+1 XP')).toBeNull()
})
