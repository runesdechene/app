/**
 * QUOI     — /flyercadeau : un e-mail contre un code promo, et chaque échec dit quelque chose de lisible.
 * POURQUOI — un visiteur arrive d'un QR imprimé, sans compte ni session : le formulaire doit tenir
 *            seul. `fetch` est simulé, rien ne part vers la fonction ni vers Shopify.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PageCadeau } from './PageCadeau'

function repondre(reponse: Response | Error) {
  const f = vi.fn(() => (reponse instanceof Error ? Promise.reject(reponse) : Promise.resolve(reponse)))
  vi.stubGlobal('fetch', f)
  return f
}

async function envoyer(email = 'claire@exemple.fr') {
  render(<PageCadeau />)
  await userEvent.type(screen.getByRole('textbox', { name: 'Ton e-mail' }), email)
  await userEvent.click(screen.getByRole('button', { name: 'Recevoir mon cadeau' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PageCadeau', () => {
  it('donne son titre à l’onglet', () => {
    render(<PageCadeau />)
    expect(document.title).toBe('Ton cadeau — Runes de Chêne')
  })

  it('garde le bouton inactif tant que l’e-mail n’est pas valide', async () => {
    render(<PageCadeau />)
    const bouton = screen.getByRole('button', { name: 'Recevoir mon cadeau' })
    expect(bouton).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Ton e-mail' }), 'claire@exemple')
    expect(bouton).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Ton e-mail' }), '.fr')
    expect(bouton).toBeEnabled()
  })

  it('laisse la case newsletter décochée au départ', () => {
    render(<PageCadeau />)
    expect(screen.getByRole('checkbox', { name: /Je veux recevoir les nouvelles/ })).not.toBeChecked()
  })

  it('montre le code et son lien vers la boutique', async () => {
    const f = repondre(Response.json({ success: true, action: 'created', promoCode: 'CONFRERIE' }))
    await envoyer(' Claire@Exemple.fr ')
    expect(await screen.findByText('CONFRERIE')).toBeInTheDocument()
    expect(screen.getByText('runesdechene.com/discount/CONFRERIE')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'J’en profite sur la boutique' })).toHaveAttribute(
      'href',
      'https://runesdechene.com/discount/CONFRERIE',
    )
    expect(f).toHaveBeenCalledWith('/.netlify/functions/flyer-create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'claire@exemple.fr', newsletter: false }),
    })
  })

  it('envoie le choix de la newsletter quand la case est cochée', async () => {
    const f = repondre(Response.json({ success: true, action: 'created', promoCode: 'CONFRERIE' }))
    render(<PageCadeau />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Ton e-mail' }), 'claire@exemple.fr')
    await userEvent.click(screen.getByRole('checkbox', { name: /Je veux recevoir les nouvelles/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir mon cadeau' }))
    await screen.findByText('CONFRERIE')
    expect(f.mock.calls[0]).toEqual([
      '/.netlify/functions/flyer-create-account',
      expect.objectContaining({ body: JSON.stringify({ email: 'claire@exemple.fr', newsletter: true }) }),
    ])
  })

  it('429 : dit d’attendre une heure', async () => {
    repondre(Response.json({ error: 'Trop de tentatives, réessaie dans un moment.' }, { status: 429 }))
    await envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Trop d’essais depuis cet appareil, réessaie dans une heure.',
    )
  })

  it.each([
    ['fonction absente (une page HTML en 404)', new Response('<!doctype html><title>Not found</title>', { status: 404 })],
    ['passerelle en panne (502 HTML)', new Response('<html>Bad gateway</html>', { status: 502 })],
    ['erreur du serveur en anglais (500)', Response.json({ error: 'Shopify create failed' }, { status: 500 })],
    ['un 200 sans code', Response.json({ success: true })],
    ['un 200 au code vide', Response.json({ success: true, promoCode: '' })],
  ])('%s : une seule phrase pour le visiteur', async (_cas, reponse) => {
    repondre(reponse)
    await envoyer()
    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent(/^Le cadeau n’a pas pu être préparé, réessaie dans un instant\.$/)
  })

  it('réseau coupé : « Connexion impossible, réessaie. »', async () => {
    repondre(new TypeError('Failed to fetch'))
    await envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent('Connexion impossible, réessaie.')
  })

  it('renvoie à la boutique et aux données personnelles', () => {
    render(<PageCadeau />)
    expect(screen.getByRole('link', { name: '← Retourner sur la boutique' })).toHaveAttribute(
      'href',
      'https://runesdechene.com',
    )
    expect(screen.getByRole('link', { name: 'Données personnelles' })).toHaveAttribute(
      'href',
      'https://app.runesdechene.com/legal/confidentialite',
    )
  })
})
