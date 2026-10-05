/**
 * QUOI     — la feuille « Une version » : qui, quand, le mot ; l'ajouté souligné, le retiré barré ;
 *            une lecture en échec ne se confond pas avec une version disparue.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { FeuilleVersionContenu, VersionChoisie } from './FeuilleVersion'

const api = vi.hoisted(() => ({ fetchVersion: vi.fn() }))
vi.mock('../api/lieu', () => api)

const LIGNE = {
  id: 7,
  quand: '2026-09-23T10:00:00Z',
  origine: false,
  champs: ['nom'],
  note: null,
  qui: null,
}

function choisir() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <VersionChoisie
        id={7}
        ligne={LIGNE}
        actuelle={false}
        enCours={false}
        onRevenir={vi.fn()}
        onRetour={vi.fn()}
      />
    </QueryClientProvider>,
  )
}

test('une version qui n’a pas pu être lue invite à réessayer', async () => {
  api.fetchVersion.mockRejectedValue(new Error('réseau'))
  choisir()
  expect(
    await screen.findByText('La version n’a pas pu être chargée. Réessaie dans un instant.'),
  ).toBeInTheDocument()
})

test('une version disparue le dit', async () => {
  api.fetchVersion.mockResolvedValue(null)
  choisir()
  expect(await screen.findByText('Cette version n’existe plus.')).toBeInTheDocument()
})

test('ce que la version a ajouté et retiré, champ par champ', () => {
  render(
    <FeuilleVersionContenu
      version={{
        id: 7,
        quand: '2026-09-23T10:00:00Z',
        note: 'la porte',
        qui: { id: 'm', nom: 'Mathéo', avatar: null },
        champs: [
          { champ: 'recit', avant: 'Il reste presque rien.', apres: 'Il reste une tour.' },
          { champ: 'acces', avant: '', apres: 'Par le sentier' },
        ],
      }}
      resume="a enrichi le récit et l’accès"
      actuelle={false}
      enCours={false}
      onRevenir={vi.fn()}
    />,
  )
  expect(screen.getByText('Mathéo')).toBeInTheDocument()
  expect(screen.getByText(/la porte/)).toBeInTheDocument()
  expect(screen.getByText(/une tour/).tagName).toBe('INS')
  expect(screen.getByText(/presque rien/).tagName).toBe('DEL')
  expect(screen.getByRole('heading', { name: 'Accès' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Revenir à cette version' })).toBeEnabled()
})

test('la version actuelle ne propose pas d’y revenir', () => {
  render(
    <FeuilleVersionContenu
      version={{ id: 8, quand: '2026-09-23T10:00:00Z', note: null, qui: null, champs: [] }}
      resume="a changé le nom"
      actuelle
      enCours={false}
      onRevenir={vi.fn()}
    />,
  )
  expect(screen.queryByRole('button', { name: 'Revenir à cette version' })).not.toBeInTheDocument()
})
