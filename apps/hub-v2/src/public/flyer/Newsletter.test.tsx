/**
 * QUOI     — l'inscription de /flyer : la newsletter acceptée part avec l'e-mail, et un échec se lit.
 * POURQUOI — `fetch` est simulé, rien ne part vers la fonction ni vers Shopify.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { PAS_INSCRIT } from '../cadeau/api'
import { Newsletter } from './Newsletter'

function repondre(reponse: Response) {
  const f = vi.fn(() => Promise.resolve(reponse))
  vi.stubGlobal('fetch', f)
  return f
}

async function inscrire(email = 'Claire@Exemple.fr ') {
  render(<Newsletter />)
  await userEvent.type(screen.getByRole('textbox', { name: 'Ton e-mail' }), email)
  await userEvent.click(screen.getByRole('button', { name: 'M’inscrire' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('inscrit l’e-mail avec la newsletter acceptée, puis le dit', async () => {
  const f = repondre(Response.json({ success: true, promoCode: 'X' }))
  await inscrire()
  expect(f).toHaveBeenCalledWith('/.netlify/functions/flyer-create-account', expect.objectContaining({
    body: JSON.stringify({ email: 'claire@exemple.fr', newsletter: true }),
  }))
  expect(await screen.findByText('C’est noté')).toBeInTheDocument()
  expect(screen.queryByText('X')).not.toBeInTheDocument()
})

it('un échec du serveur se lit, sans parler de cadeau', async () => {
  repondre(Response.json({ error: 'Shopify create failed' }, { status: 500 }))
  await inscrire()
  expect(await screen.findByRole('alert')).toHaveTextContent(PAS_INSCRIT)
})
