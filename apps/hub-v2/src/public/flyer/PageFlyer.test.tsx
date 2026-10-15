/**
 * QUOI     — /flyer : les cinq liens, dans l'ordre, avec leurs adresses exactes.
 * POURQUOI — le QR imprimé mène ici : un lien perdu ou faux se voit sur le papier, pas dans le code.
 */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageFlyer } from './PageFlyer'

describe('PageFlyer', () => {
  it('liste les cinq liens, dans l’ordre, avec leurs adresses', () => {
    render(<PageFlyer />)
    const liens = within(screen.getByRole('list')).getAllByRole('link')
    expect(liens.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['La boutiqueLes vêtements Runes de Chêne', 'https://runesdechene.com'],
      ['L’application ExploreLes lieux oubliés, autour de toi', 'https://app.runesdechene.com'],
      ['Ton cadeau de bienvenueUn code pour ta première commande', '/flyercadeau'],
      ['Instagram@runesdechene', 'https://www.instagram.com/runesdechene'],
      ['Fellowship — nos événementsOù nous croiser cette saison', 'https://flw.sh/runesdechene'],
    ])
  })

  it('ouvre les liens dans le même onglet', () => {
    render(<PageFlyer />)
    for (const lien of screen.getAllByRole('link')) expect(lien).not.toHaveAttribute('target')
  })

  it('montre le logo, la devise et l’adresse du site', () => {
    render(<PageFlyer />)
    expect(screen.getByRole('heading', { level: 1, name: /Runes de Chêne/ })).toBeInTheDocument()
    expect(screen.getByText('runesdechene.com')).toBeInTheDocument()
  })
})
