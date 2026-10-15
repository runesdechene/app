/**
 * QUOI     — /soumettre-contenu de bout en bout : la mission présélectionnée, les quatre étapes et
 *            leurs verrous, l'envoi fichier par fichier, le dépôt et ses refus.
 * POURQUOI — un joueur arrive d'un QR imprimé, sans compte : chaque verrou et chaque échec doit se
 *            lire. Supabase est simulé ; la compression aussi (jsdom ne dessine pas d'image).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PageSoumettre } from './PageSoumettre'

type Reponse = { data: unknown; error: { message: string; hint?: string } | null }

const { faux } = vi.hoisted(() => ({
  faux: {
    config: { bg_image_url: 'https://exemple.fr/fond.webp', aside_image_url: '', welcome_crowns: 30 },
    upload: vi.fn<(chemin: string, f: File, options: object) => Promise<Reponse>>(),
    deposer: vi.fn<(args: Record<string, unknown>) => Promise<Reponse>>(),
  },
}))

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                { slug: 'hoplite', title: 'L’Hoplite' },
                { slug: 'druide', title: 'Le Druide' },
              ],
              error: null,
            }),
        }),
      }),
    }),
    rpc: (nom: string, args: Record<string, unknown>) =>
      nom === 'get_studio_config' ? Promise.resolve({ data: faux.config, error: null }) : faux.deposer(args),
    storage: { from: () => ({ upload: faux.upload }) },
  },
}))

vi.mock('./lib/compression', () => ({ versWebp: (f: File) => Promise.resolve(f) }))

const CHEMIN = /^submissions\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => `blob:${crypto.randomUUID()}`)
  URL.revokeObjectURL = vi.fn()
  faux.upload.mockReset().mockResolvedValue({ data: {}, error: null })
  faux.deposer.mockReset().mockResolvedValue({ data: { nouveauCompte: false }, error: null })
})

function ouvrir(adresse = '/soumettre-contenu') {
  const router = createMemoryRouter([{ path: '/soumettre-contenu', element: <PageSoumettre /> }], {
    initialEntries: [adresse],
  })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

const photo = (nom: string) => new File(['x'], nom, { type: 'image/jpeg' })
const bouton = (nom: RegExp | string) => screen.getByRole('button', { name: nom })

async function deposer(...noms: string[]) {
  await userEvent.upload(screen.getByLabelText(/Glisse ou clique pour ajouter/), noms.map(photo))
}

/** Les trois premières étapes passées, une taille M pour chaque fichier. */
async function jusquAToi(noms = ['a.jpg', 'b.jpg'], adresse = '/soumettre-contenu') {
  ouvrir(adresse)
  await screen.findByRole('heading', { name: 'Tes contenus' })
  await deposer(...noms)
  await userEvent.click(bouton(/^Suivant/))
  for (let i = 0; i < noms.length; i++) {
    await userEvent.click(bouton('M'))
    await userEvent.click(bouton(/^(Suivant|Continuer)/))
  }
  await userEvent.click(bouton(/^Suivant/))
  await screen.findByRole('heading', { name: 'Toi' })
}

async function remplirToi() {
  await userEvent.type(screen.getByRole('textbox', { name: 'Prénom *' }), 'Claire')
  await userEvent.type(screen.getByRole('textbox', { name: 'E-mail *' }), 'claire@exemple.fr')
  await userEvent.click(screen.getByRole('checkbox', { name: /diffusés par la marque/ }))
  await userEvent.click(screen.getByRole('checkbox', { name: /création de mon compte/ }))
}

async function envoyer() {
  await userEvent.click(bouton(/^Envoyer mes contenus/))
}

describe('la mission', () => {
  it('?quete=hoplite présélectionne la mission', async () => {
    ouvrir('/soumettre-contenu?quete=hoplite')
    const choix = await screen.findByRole('combobox', { name: /mission en cours/ })
    expect(choix).toHaveValue('hoplite')
  })

  it('une quête inconnue ne présélectionne rien', async () => {
    ouvrir('/soumettre-contenu?quete=fantome')
    const choix = await screen.findByRole('combobox', { name: /mission en cours/ })
    expect(choix).toHaveValue('')
  })
})

describe('les étapes', () => {
  it('on n’avance pas sans fichier, même en tapant ?etape=3', async () => {
    ouvrir('/soumettre-contenu?etape=3')
    expect(await screen.findByRole('heading', { name: 'Tes contenus' })).toBeInTheDocument()
    expect(bouton(/^Suivant/)).toBeDisabled()
  })

  it('un fichier refusé se dit, avec son nom', async () => {
    ouvrir()
    await userEvent.upload(
      screen.getByLabelText(/Glisse ou clique pour ajouter/),
      new File(['x'], 'danse.gif', { type: 'image/gif' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('« danse.gif » n’est pas accepté')
  })

  it('l’étape est dans l’adresse, ?quete= y reste', async () => {
    const router = ouvrir('/soumettre-contenu?quete=hoplite')
    await deposer('a.jpg')
    await userEvent.click(bouton(/^Suivant/))
    expect(await screen.findByRole('heading', { name: 'Quelle taille portes-tu ?' })).toBeInTheDocument()
    const params = new URLSearchParams(router.state.location.search)
    expect(params.get('etape')).toBe('2')
    expect(params.get('quete')).toBe('hoplite')
  })

  it('on n’avance pas sans une taille pour chaque fichier', async () => {
    ouvrir()
    await deposer('a.jpg', 'b.jpg')
    await userEvent.click(bouton(/^Suivant/))
    expect(bouton(/^Suivant/)).toBeDisabled()
    await userEvent.click(bouton('L'))
    await userEvent.click(bouton(/^Suivant/))
    expect(screen.getByText(/Contenu 2 \/ 2/)).toBeInTheDocument()
    expect(bouton(/^Continuer/)).toBeDisabled()
    await userEvent.click(bouton('Aucun produit'))
    await userEvent.click(bouton(/^Continuer/))
    expect(await screen.findByRole('heading', { name: 'Ton histoire' })).toBeInTheDocument()
  })

  it('on n’envoie pas sans prénom, e-mail et les deux accords', async () => {
    await jusquAToi()
    const bout = bouton(/^Envoyer mes contenus/)
    expect(bout).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Prénom *' }), 'Claire')
    await userEvent.type(screen.getByRole('textbox', { name: 'E-mail *' }), 'claire@exemple.fr')
    await userEvent.click(screen.getByRole('checkbox', { name: /diffusés par la marque/ }))
    expect(bout).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: /création de mon compte/ }))
    expect(bout).toBeEnabled()
  })
})

describe('l’envoi', () => {
  it('dit « fichier n sur N »', async () => {
    faux.upload.mockReturnValueOnce(new Promise<Reponse>(() => undefined))
    await jusquAToi()
    await remplirToi()
    await envoyer()
    expect(await screen.findByRole('status')).toHaveTextContent('Envoi du fichier 1 sur 2…')
  })

  it('un fichier en échec, deux réussis : le dépôt reçoit les deux chemins', async () => {
    faux.upload.mockResolvedValueOnce({ data: null, error: { message: 'Payload too large' } })
    await jusquAToi(['a.jpg', 'b.jpg', 'c.jpg'], '/soumettre-contenu?quete=hoplite')
    await remplirToi()
    await envoyer()
    expect(await screen.findByRole('heading', { name: 'Bienvenue dans le Mouvement !' })).toBeInTheDocument()

    expect(faux.upload).toHaveBeenCalledTimes(3)
    const [, deuxieme, troisieme] = faux.upload.mock.calls.map(([chemin]) => chemin)
    expect(deuxieme).toMatch(CHEMIN)
    expect(faux.upload.mock.calls[0]?.[2]).toEqual({ contentType: 'image/jpeg', upsert: false })
    expect(faux.deposer).toHaveBeenCalledWith(
      expect.objectContaining({
        p_email: 'claire@exemple.fr',
        p_nom: 'Claire',
        p_images: [
          { path: deuxieme, size: 'M' },
          { path: troisieme, size: 'M' },
        ],
        p_consent_brand: true,
        p_consent_account: true,
        p_quest_ref: 'hoplite',
      }),
    )
    expect(screen.getByText(/Envoyés : 2 sur 3\./)).toBeInTheDocument()
  })

  it('aucun fichier réussi : rien n’est déposé, le formulaire reste rempli', async () => {
    faux.upload.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    await jusquAToi()
    await remplirToi()
    await envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Aucun fichier n’a pu partir/)
    expect(faux.deposer).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Prénom *' })).toHaveValue('Claire')
    expect(bouton(/^Envoyer mes contenus/)).toBeEnabled()
  })

  it('un nouveau compte reçoit les couronnes de bienvenue', async () => {
    faux.deposer.mockResolvedValue({ data: { nouveauCompte: true }, error: null })
    await jusquAToi(['a.jpg'])
    await remplirToi()
    await envoyer()
    await screen.findByRole('heading', { name: 'Bienvenue dans le Mouvement !' })
    expect(screen.getByText('+30 Couronnes')).toBeInTheDocument()
  })

  it('un compte existant n’en reçoit pas', async () => {
    await jusquAToi(['a.jpg'])
    await remplirToi()
    await envoyer()
    await screen.findByRole('heading', { name: 'Bienvenue dans le Mouvement !' })
    expect(screen.queryByText(/Couronnes$/)).not.toBeInTheDocument()
  })

  it('le refus de la base (5 envois par heure) se dit tel quel', async () => {
    faux.deposer.mockResolvedValue({
      data: null,
      error: { message: 'Trop d’envois d’un coup : réessaie dans une heure', hint: 'limite' },
    })
    await jusquAToi(['a.jpg'])
    await remplirToi()
    await envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /^Trop d’envois d’un coup : réessaie dans une heure\.$/,
    )
  })

  it('une autre erreur de la base ne montre jamais son texte', async () => {
    faux.deposer.mockResolvedValue({ data: null, error: { message: 'permission denied for function' } })
    await jusquAToi(['a.jpg'])
    await remplirToi()
    await envoyer()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /^Ton envoi n’a pas pu être enregistré, réessaie dans un instant\.$/,
    )
  })
})
