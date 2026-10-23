import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Choix } from './Choix'

const OPTIONS = [
  { valeur: 'missive', libelle: 'Missive — les nouvelles', groupe: 'Lettres', detail: '12 envois' },
  { valeur: 'carnet', libelle: 'Carnet de route', groupe: 'Lettres' },
  { valeur: 'fragment', libelle: 'Fragment — un drop', groupe: 'Fragments' },
]

function monter(onChange = vi.fn()) {
  render(<Choix valeur="missive" options={OPTIONS} onChange={onChange} recherche="Chercher un modèle…" libelleAccessible="Le modèle" />)
  return onChange
}

test('fermé, le choix montre l’option retenue ; ouvert, les groupes', async () => {
  monter()
  const bouton = screen.getByRole('button', { name: /Le modèle/ })
  expect(bouton).toHaveTextContent('Missive — les nouvelles')
  expect(bouton).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(bouton)
  expect(bouton).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('group', { name: 'Lettres' })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Fragments' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: /Missive — les nouvelles/ })).toHaveAttribute('aria-selected', 'true')
})

test('taper « carn » ne garde que Carnet de route, Entrée le choisit et referme', async () => {
  const onChange = monter()
  await userEvent.click(screen.getByRole('button', { name: /Le modèle/ }))
  await userEvent.type(screen.getByRole('searchbox', { name: 'Chercher' }), 'carn')
  expect(screen.getAllByRole('option')).toHaveLength(1)
  await userEvent.keyboard('{Enter}')
  expect(onChange).toHaveBeenCalledWith('carnet')
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
})

test('les flèches parcourent les options, Échap referme sans rien changer', async () => {
  const onChange = monter()
  await userEvent.click(screen.getByRole('button', { name: /Le modèle/ }))
  await userEvent.keyboard('{ArrowDown}')
  expect(screen.getByRole('option', { name: /Carnet de route/ })).toHaveAttribute('data-actif', 'true')
  await userEvent.keyboard('{Escape}')
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
})

test('un clic sur une option la choisit', async () => {
  const onChange = monter()
  await userEvent.click(screen.getByRole('button', { name: /Le modèle/ }))
  await userEvent.click(screen.getByRole('option', { name: /Fragment — un drop/ }))
  expect(onChange).toHaveBeenCalledWith('fragment')
})
