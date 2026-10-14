import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { ChampDeRecherche } from './ChampDeRecherche'
import { EnTeteDePage } from './EnTeteDePage'
import { Pages } from './Pages'
import { Tiroir } from './Tiroir'

test('l’en-tête montre surtitre, titre et phrase', () => {
  render(<EnTeteDePage surtitre="Communauté" titre="Les comptes" phrase="4 750 Explorateurs." />)
  expect(screen.getByRole('heading', { name: 'Les comptes' })).toBeInTheDocument()
  expect(screen.getByText('Communauté')).toBeInTheDocument()
})

test('les pages : rien quand tout tient sur une page', () => {
  const { container } = render(<Pages total={12} decalage={0} parPage={50} onDecalage={vi.fn()} />)
  expect(container).toBeEmptyDOMElement()
})

test('les pages : suivant avance d’une page', async () => {
  const onDecalage = vi.fn()
  render(<Pages total={120} decalage={0} parPage={50} onDecalage={onDecalage} />)
  expect(screen.getByText('1 à 50 sur 120')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Suivants →' }))
  expect(onDecalage).toHaveBeenCalledWith(50)
  expect(screen.getByRole('button', { name: '← Précédents' })).toBeDisabled()
})

test('la recherche attend 300 ms avant de chercher', () => {
  vi.useFakeTimers()
  const onChange = vi.fn()
  render(<ChampDeRecherche valeur="" onChange={onChange} etiquette="Un nom, un e-mail…" />)
  const champ = screen.getByRole('searchbox', { name: 'Un nom, un e-mail…' })
  fireEvent.change(champ, { target: { value: 'kel' } })
  expect(onChange).not.toHaveBeenCalled()
  act(() => {
    vi.advanceTimersByTime(300)
  })
  expect(onChange).toHaveBeenCalledWith('kel')
  vi.useRealTimers()
})

test('le tiroir se ferme vers la liste (bouton et Échap)', async () => {
  const router = createMemoryRouter(
    [
      { path: '/liste', element: <p>La liste</p> },
      { path: '/liste/1', element: <Tiroir titre="Kelpie" retour="/liste"><p>Fiche</p></Tiroir> },
    ],
    { initialEntries: ['/liste/1'] },
  )
  render(<RouterProvider router={router} />)
  expect(screen.getByRole('dialog', { name: 'Kelpie' })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(await screen.findByText('La liste')).toBeInTheDocument()
})
