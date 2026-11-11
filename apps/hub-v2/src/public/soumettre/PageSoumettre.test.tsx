/**
 * QUOI     — /soumettre-contenu de bout en bout : le choix, les deux chemins (un avis, des photos) et
 *            leurs verrous, l'envoi fichier par fichier, le dépôt et ses refus.
 * POURQUOI — un joueur arrive d'un QR imprimé, sans compte : chaque verrou et chaque échec doit se
 *            lire. Supabase est simulé ; la compression aussi (jsdom ne dessine pas d'image).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
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
    rpc: (nom: string, args: Record<string, unknown>) =>
      nom === 'get_studio_config' ? Promise.resolve({ data: faux.config, error: null }) : faux.deposer(args),
    storage: { from: () => ({ upload: faux.upload }) },
  },
}))

vi.mock('./lib/compression', () => ({ versWebp: (f: File) => Promise.resolve(f) }))

const CHEMIN = /^submissions\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/

// Les aperçus : chaque adresse créée doit être libérée.
const creer = vi.fn<(f: Blob) => string>(() => `blob:${crypto.randomUUID()}`)
const liberer = vi.fn<(adresse: string) => void>()
const creees = () => creer.mock.results.map((r) => String(r.value))

beforeEach(() => {
  creer.mockClear()
  liberer.mockClear()
  URL.createObjectURL = creer
  URL.revokeObjectURL = liberer
  faux.upload.mockReset().mockResolvedValue({ data: {}, error: null })
  faux.deposer.mockReset().mockResolvedValue({ data: { nouveauCompte: false }, error: null })
})

function ouvrir(adresse = '/soumettre-contenu?chemin=photos') {
  const router = createMemoryRouter([{ path: '/soumettre-contenu', element: <PageSoumettre /> }], {
    initialEntries: [adresse],
  })
  const rendu = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, rendu }
}

const photo = (nom: string) => new File(['x'], nom, { type: 'image/jpeg' })
const bouton = (nom: RegExp | string) => screen.getByRole('button', { name: nom })

async function deposer(...noms: string[]) {
  await userEvent.upload(screen.getByLabelText(/Glisse ou clique pour ajouter/), noms.map(photo))
}

/** Des photos : une taille M pour chacune, l'avis passé sans rien remplir. */
async function jusquAToi(noms = ['a.jpg', 'b.jpg'], adresse = '/soumettre-contenu?chemin=photos') {
  ouvrir(adresse)
  await screen.findByRole('heading', { name: 'Tes photos' })
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

const etoile = (note: string, n: number) =>
  within(screen.getByRole('group', { name: note })).getByRole('button', { name: `${String(n)} sur 5` })

async function remplirAvis() {
  await userEvent.click(await screen.findByRole('button', { name: 'Sweatshirt' }))
  await userEvent.click(etoile('La qualité du produit', 4))
}

describe('le choix', () => {
  it('sans chemin, la page demande ce qu’on veut partager', async () => {
    ouvrir('/soumettre-contenu')
    expect(await screen.findByRole('heading', { name: 'Que veux-tu partager ?' })).toBeInTheDocument()
    expect(screen.getByText('Étape 1 sur 4')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Commencer/ })).not.toBeInTheDocument()
  })

  it('un clic sur « Un avis » ouvre l’avis, dans l’adresse', async () => {
    const { router } = ouvrir('/soumettre-contenu')
    await userEvent.click(await screen.findByRole('button', { name: /^Un avis/ }))
    expect(await screen.findByRole('heading', { name: 'Ton avis', level: 1 })).toBeInTheDocument()
    expect(router.state.location.search).toContain('chemin=avis')
  })

  it('un lien de mission déjà imprimé ouvre directement les photos', async () => {
    ouvrir('/soumettre-contenu?quete=hoplite')
    expect(await screen.findByRole('heading', { name: 'Tes photos' })).toBeInTheDocument()
    expect(screen.getByText('Étape 2 sur 4')).toBeInTheDocument()
  })
})

describe('les missions, mises de côté (Uriel, 11/11)', () => {
  it('les photos ne proposent plus de mission, et l’envoi n’en porte pas', async () => {
    await jusquAToi(['a.jpg'], '/soumettre-contenu?quete=hoplite')
    await remplirToi()
    await envoyer()
    await screen.findByRole('heading', { name: 'Bienvenue dans le Mouvement !' })
    expect(screen.queryByRole('combobox', { name: /mission/ })).not.toBeInTheDocument()
    expect(faux.deposer.mock.calls[0]?.[0]).not.toHaveProperty('p_quest_ref')
  })
})

describe('les étapes', () => {
  it('des photos : on n’avance pas sans fichier, même en tapant ?etape=5', async () => {
    ouvrir('/soumettre-contenu?chemin=photos&etape=5')
    expect(await screen.findByRole('heading', { name: 'Tes photos' })).toBeInTheDocument()
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

  it('l’étape est dans l’adresse', async () => {
    const { router } = ouvrir('/soumettre-contenu?quete=hoplite')
    await deposer('a.jpg')
    await userEvent.click(bouton(/^Suivant/))
    expect(await screen.findByRole('heading', { name: 'Quelle taille portes-tu ?' })).toBeInTheDocument()
    const params = new URLSearchParams(router.state.location.search)
    expect(params.get('etape')).toBe('3')
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
    expect(await screen.findByRole('heading', { name: 'Ton avis', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Étape 3 sur 4')).toBeInTheDocument()
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
      }),
    )
    expect(screen.getByText('Pas parti : a.jpg')).toBeInTheDocument()
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

  it('libère les aperçus une fois l’envoi réussi', async () => {
    await jusquAToi()
    await remplirToi()
    const crees = creees()
    expect(crees).toHaveLength(2)
    await envoyer()
    await screen.findByRole('heading', { name: 'Bienvenue dans le Mouvement !' })
    for (const apercu of crees) expect(liberer).toHaveBeenCalledWith(apercu)
  })
})

describe('un avis', () => {
  it('« Suivant » attend un vêtement et une note', async () => {
    ouvrir('/soumettre-contenu?chemin=avis')
    expect(await screen.findByRole('heading', { name: 'Ton avis', level: 2 })).toBeInTheDocument()
    expect(bouton(/^Suivant/)).toBeDisabled()
    await remplirAvis()
    expect(bouton(/^Suivant/)).toBeEnabled()
  })

  it('l’avis part sans fichier, sans compte, avec son vêtement', async () => {
    ouvrir('/soumettre-contenu?chemin=avis')
    await remplirAvis()
    await userEvent.type(screen.getByRole('textbox', { name: 'Ton avis, en quelques mots' }), 'Très doux')
    await userEvent.click(bouton(/^Suivant/))
    await userEvent.click(await screen.findByRole('button', { name: /^Continuer sans photo/ }))
    expect(await screen.findByText('Étape 4 sur 4')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Prénom *' }), 'Claire')
    await userEvent.type(screen.getByRole('textbox', { name: 'E-mail *' }), 'claire@exemple.fr')
    await userEvent.click(bouton(/^Publier mon avis/))

    expect(await screen.findByRole('heading', { name: 'Merci pour ton avis !' })).toBeInTheDocument()
    expect(faux.upload).not.toHaveBeenCalled()
    expect(faux.deposer).toHaveBeenCalledWith(
      expect.objectContaining({
        p_email: 'claire@exemple.fr',
        p_nom: 'Claire',
        p_images: [],
        p_garment_type: 'sweatshirt',
        p_rating_products: 4,
        p_message: 'Très doux',
        p_consent_brand: true,
        p_consent_account: false,
      }),
    )
  })

  it('le lien de l’e-mail pré-remplit le vêtement et l’adresse', async () => {
    ouvrir('/soumettre-contenu?chemin=avis&email=claire@exemple.fr&type=sweatshirt')
    expect(await screen.findByRole('button', { name: 'Sweatshirt' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(etoile('Ton expérience avec Runes de Chêne', 5))
    await userEvent.click(bouton(/^Suivant/))
    await userEvent.click(await screen.findByRole('button', { name: /^Continuer sans photo/ }))
    expect(await screen.findByRole('textbox', { name: 'E-mail *' })).toHaveValue('claire@exemple.fr')
  })

  it('un type inconnu ne présélectionne rien', async () => {
    ouvrir('/soumettre-contenu?chemin=avis&type=casquette')
    await screen.findByRole('heading', { name: 'Ton avis', level: 2 })
    for (const pastille of ['T-shirt', 'Sweatshirt', 'Veste Zip']) {
      expect(bouton(pastille)).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('un souci renvoie vers le SAV, par e-mail', async () => {
    ouvrir('/soumettre-contenu?chemin=avis')
    expect(await screen.findByRole('textbox', { name: 'Ton avis, en quelques mots' })).toHaveAttribute(
      'placeholder',
      'Ce que tu as pensé de ton achat, de ton expérience auprès de notre boutique ou de notre stand…',
    )
    expect(screen.getByRole('link', { name: 'contact@runesdechene.com' })).toHaveAttribute('href', 'mailto:contact@runesdechene.com')
  })

  it('?etape=5 sans avis rempli reste sur « Ton avis »', async () => {
    ouvrir('/soumettre-contenu?chemin=avis&etape=5')
    expect(await screen.findByRole('heading', { name: 'Ton avis', level: 2 })).toBeInTheDocument()
  })

  it('après l’avis, on peut ajouter une photo : ses tailles, puis les accords', async () => {
    ouvrir('/soumettre-contenu?chemin=avis')
    await remplirAvis()
    await userEvent.click(bouton(/^Suivant/))
    expect(await screen.findByRole('heading', { name: 'Tes photos' })).toBeInTheDocument()
    expect(screen.getByText('Étape 3 sur 4')).toBeInTheDocument()
    await deposer('a.jpg')
    await userEvent.click(bouton(/^Suivant/))
    await userEvent.click(bouton('M'))
    await userEvent.click(bouton(/^(Suivant|Continuer)/))
    await screen.findByRole('heading', { name: 'Toi' })
    await remplirToi()
    await envoyer()
    await screen.findByRole('heading', { name: 'Bienvenue dans le Mouvement !' })
    expect(faux.deposer).toHaveBeenCalledWith(
      expect.objectContaining({ p_garment_type: 'sweatshirt', p_rating_products: 4, p_consent_account: true }),
    )
  })
})

describe('des photos', () => {
  it('l’avis est facultatif ; rempli, il part avec les photos', async () => {
    ouvrir()
    await deposer('a.jpg')
    await userEvent.click(bouton(/^Suivant/))
    await userEvent.click(bouton('M'))
    await userEvent.click(bouton(/^(Suivant|Continuer)/))
    await screen.findByRole('heading', { name: 'Ton avis', level: 2 })
    expect(bouton(/^Suivant/)).toBeEnabled()
    await userEvent.click(bouton('Veste Zip'))
    await userEvent.click(etoile('La qualité du produit', 3))
    await userEvent.click(bouton(/^Suivant/))
    await remplirToi()
    await envoyer()
    await screen.findByRole('heading', { name: 'Bienvenue dans le Mouvement !' })
    expect(faux.deposer).toHaveBeenCalledWith(expect.objectContaining({ p_garment_type: 'veste_zip', p_rating_products: 3 }))
  })
})

describe('les aperçus', () => {
  it('sont libérés quand on quitte la page', async () => {
    const { rendu } = ouvrir()
    await deposer('a.jpg', 'b.jpg')
    const crees = creees()
    expect(liberer).not.toHaveBeenCalled()
    rendu.unmount()
    for (const apercu of crees) expect(liberer).toHaveBeenCalledWith(apercu)
  })
})
