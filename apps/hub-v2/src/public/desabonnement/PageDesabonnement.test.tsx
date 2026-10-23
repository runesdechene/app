/**
 * QUOI     — /desabonnement : le lien du pied des Missives. Un clic retire l'accord, avec le jeton de l'adresse.
 * POURQUOI — le désabonnement attend un clic : un scanner de liens (Outlook) qui ouvre la page ne
 *            désabonne personne. `fetch` est simulé.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PageDesabonnement } from './PageDesabonnement'

function monter(adresse = '/desabonnement?j=u1.signature') {
  render(
    <MemoryRouter initialEntries={[adresse]}>
      <PageDesabonnement />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PageDesabonnement', () => {
  it('n’appelle rien à l’ouverture, puis envoie le jeton de l’adresse au clic', async () => {
    const f = vi.fn(() => Promise.resolve(Response.json({ ok: true })))
    vi.stubGlobal('fetch', f)
    monter()
    expect(f).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Me désabonner' }))
    expect(f).toHaveBeenCalledWith('/.netlify/functions/missives-desabonnement', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ j: 'u1.signature' }),
    }))
    expect(await screen.findByText('Tu ne recevras plus nos Missives.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Je me suis trompé' })).toHaveAttribute('href', 'https://runesdechene.com')
  })

  it('un lien abîmé le dit, sans rien promettre', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.json({ error: 'Lien invalide' }, { status: 400 }))))
    monter()
    await userEvent.click(screen.getByRole('button', { name: 'Me désabonner' }))
    expect(await screen.findByText(/Ce lien ne fonctionne plus/)).toBeInTheDocument()
  })
})
