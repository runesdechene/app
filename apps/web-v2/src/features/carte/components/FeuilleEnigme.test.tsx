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

function monter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <FeuilleEnigme touchee={{ id: 4, x: 100, y: 200 }} onFermer={() => undefined} />
    </QueryClientProvider>,
  )
}

// jsdom n'anime rien : une fois l'énigme chargée (le sceau porte `data-retourne`), la fin du
// retournement se déclenche à la main.
async function retourner() {
  await waitFor(() => {
    expect(document.querySelector('[data-retourne]')).not.toBeNull()
  })
  fireEvent.animationEnd(screen.getByText('?'))
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
    resteEnAttente: 2,
  })
  monter()
  await retourner()
  fireEvent.click(await screen.findByRole('button', { name: 'Sainte-Sophie' }))
  expect(await screen.findByText('+1 XP')).toBeInTheDocument()
  expect(percerEnigme).toHaveBeenCalledWith(4, 'Sainte-Sophie')
  expect(screen.getByText('Te voilà Apprentie de Byzance.')).toBeInTheDocument()
  expect(screen.getByText('La plus grande coupole…')).toBeInTheDocument()
  expect(screen.getByText('2 autres « ? » t’attendent sur la carte.')).toBeInTheDocument()
})

test('une énigme rendormie le dit', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  percerEnigme.mockRejectedValue({ code: 'P0002' })
  monter()
  await retourner()
  fireEvent.click(await screen.findByRole('button', { name: 'Sainte-Irène' }))
  expect(await screen.findByText('Cette énigme s’est rendormie.')).toBeInTheDocument()
})
