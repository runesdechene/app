/**
 * QUOI     — le choix du calendrier : chaque option montre la date du jour qu'elle donnerait.
 */
import { CALENDRIERS, dateEnClair } from '@runes/calendrier'
import { render, screen } from '@testing-library/react'
import { ChoixDuCalendrier } from './ChoixDuCalendrier'

test('chacun des quatre calendriers montre sa date du jour', () => {
  render(<ChoixDuCalendrier valeur="chretien" onChange={() => undefined} />)
  const lignes = screen.getAllByText(/^Aujourd'hui : /).map((l) => l.textContent)
  const jour = new Date()
  expect(lignes).toEqual(
    CALENDRIERS.map((c) => `Aujourd'hui : ${dateEnClair(jour, c.id)}`),
  )
})
