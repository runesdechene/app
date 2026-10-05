/**
 * QUOI     — la feuille « Une version » : qui, quand, le mot ; l'ajouté souligné, le retiré barré.
 */
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { FeuilleVersionContenu } from './FeuilleVersion'

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
      actuelle
      enCours={false}
      onRevenir={vi.fn()}
    />,
  )
  expect(screen.queryByRole('button', { name: 'Revenir à cette version' })).not.toBeInTheDocument()
})
