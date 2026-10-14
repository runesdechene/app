import { vi } from 'vitest'
import { AccesShopifyRefuse, chercherProduits, graphqlShopify, lireIllustrations, lireInventaireAudio, lireProduitsSansIllustration, pousserImage, retirerImage } from './shopify'

const appel = vi.hoisted(() => ({ appelerFonction: vi.fn(), lireReponse: vi.fn() }))
vi.mock('@/shared/lib/fonctions', () => appel)

const repond = (corps: unknown) => {
  appel.appelerFonction.mockResolvedValue({})
  appel.lireReponse.mockResolvedValue(corps)
}

beforeEach(() => { vi.resetAllMocks() })

test('ACCESS_DENIED devient AccesShopifyRefuse avec sa portée', async () => {
  repond({ errors: [{ message: 'Access denied for metaobjects field. Required access: `read_metaobjects` access scope.', extensions: { code: 'ACCESS_DENIED' } }] })
  const erreur = await graphqlShopify('{}').catch((e: unknown) => e)
  expect(erreur).toBeInstanceOf(AccesShopifyRefuse)
  expect((erreur as AccesShopifyRefuse).portee).toBe('read_metaobjects')
})

test('la portée par défaut quand le message ne la nomme pas', async () => {
  repond({ errors: [{ message: 'Refusé', extensions: { code: 'ACCESS_DENIED' } }] })
  const erreur = await graphqlShopify('{}').catch((e: unknown) => e)
  expect((erreur as AccesShopifyRefuse).portee).toBe('read_metaobjects')
})

test('des errors en HTTP 200 sont une erreur', async () => {
  repond({ errors: [{ message: 'Throttled' }] })
  await expect(graphqlShopify('{}')).rejects.toThrow('Throttled')
})

test('plus de 100 Illustrations : refus explicite', async () => {
  repond({ data: { metaobjects: { pageInfo: { hasNextPage: true }, nodes: [] } } })
  await expect(lireIllustrations()).rejects.toThrow('Plus de 100 Illustrations')
})

test('aucune Illustration : inventaire vide', async () => {
  repond({ data: { metaobjects: { pageInfo: { hasNextPage: false }, nodes: [] } } })
  await expect(lireIllustrations()).rejects.toThrow('Aucune Illustration')
})

test('une Illustration lue', async () => {
  repond({ data: { metaobjects: { pageInfo: { hasNextPage: false }, nodes: [{ handle: 'hoplite', displayName: 'Hoplite', fields: [{ key: 'collection', value: null, reference: { handle: 'hoplite' } }] }] } } })
  expect(await lireIllustrations()).toEqual([expect.objectContaining({ handle: 'hoplite', nom: 'Hoplite', collection: 'hoplite', audio_url: '' })])
})

describe('retirerImage', () => {
  const NETLIFY = 'Les fonctions Netlify ne répondent pas (HTTP 404). En local elles ne tournent pas : tester sur le site de préparation.'

  test('le 404 JSON de Shopify (« Not Found ») est une réussite : l’image n’y est déjà plus', async () => {
    appel.appelerFonction.mockResolvedValue(new Response('{"errors":"Not Found"}', { status: 404 }))
    appel.lireReponse.mockRejectedValue(new Error('Not Found'))
    await expect(retirerImage('12', '34')).resolves.toBeUndefined()
    expect(appel.appelerFonction).toHaveBeenCalledWith('shopify-proxy', {
      methode: 'DELETE', parametres: { endpoint: 'products/12/images/34.json' },
    })
  })

  test('un 404 qui n’a pas atteint Shopify (fonction absente) est une erreur', async () => {
    appel.appelerFonction.mockResolvedValue(new Response('<html>Not found</html>', { status: 404 }))
    appel.lireReponse.mockRejectedValue(new Error(NETLIFY))
    await expect(retirerImage('12', '34')).rejects.toThrow(`Fiche produit Shopify : ${NETLIFY}`)
  })

  test('un 500 « Not Found » est une erreur nommée', async () => {
    appel.appelerFonction.mockResolvedValue(new Response('{"errors":"Not Found"}', { status: 500 }))
    appel.lireReponse.mockRejectedValue(new Error('Not Found'))
    await expect(retirerImage('12', '34')).rejects.toThrow('Fiche produit Shopify : Not Found')
  })

  test('une réponse 200 au corps vide est une réussite', async () => {
    appel.appelerFonction.mockResolvedValue(new Response('', { status: 200 }))
    await expect(retirerImage('12', '34')).resolves.toBeUndefined()
    expect(appel.lireReponse).not.toHaveBeenCalled()
  })

  test('un 200 qui répond du HTML n’est pas une réussite', async () => {
    appel.appelerFonction.mockResolvedValue(new Response('<html></html>', { status: 200 }))
    appel.lireReponse.mockRejectedValue(new Error(NETLIFY))
    await expect(retirerImage('12', '34')).rejects.toThrow('Fiche produit Shopify')
  })
})

describe('pousserImage', () => {
  test('rend l’identifiant de l’image', async () => {
    repond({ image: { id: 99 } })
    expect(await pousserImage('12', 'https://x/a.jpg', 'Brune porte du M')).toBe('99')
    expect(appel.appelerFonction).toHaveBeenCalledWith('shopify-proxy', {
      methode: 'POST', parametres: { endpoint: 'products/12/images.json' },
      corps: { image: { src: 'https://x/a.jpg', alt: 'Brune porte du M' } },
    })
  })

  test('une réponse sans image est une erreur', async () => {
    repond({})
    await expect(pousserImage('12', 'https://x/a.jpg', '')).rejects.toThrow('Shopify n’a pas rendu l’identifiant')
  })
})

describe('chercherProduits', () => {
  test('moins de deux caractères : rien à chercher', async () => {
    expect(await chercherProduits(' v ')).toEqual([])
    expect(appel.appelerFonction).not.toHaveBeenCalled()
  })

  test('le titre est échappé et le prix écrit sans décimales', async () => {
    repond({ data: { products: { edges: [{ node: {
      legacyResourceId: '7', title: 'Veste', handle: 'veste', featuredImage: { url: 'https://x/v.jpg' },
      priceRangeV2: { minVariantPrice: { amount: '49.00', currencyCode: 'EUR' } },
    } }] } } })
    const produits = await chercherProduits('ve"ste')
    expect(produits).toEqual([{ id: '7', titre: 'Veste', handle: 'veste', image: 'https://x/v.jpg', prix: expect.stringMatching(/^49\s€$/) as string }])
    const corps = (appel.appelerFonction.mock.calls[0] as [string, { corps: { query: string } }])[1].corps
    expect(corps.query).toContain('title:*ve\\"ste*')
  })
})

test('l’inventaire audio : le nom, la voix off présente ou non, la troncature', async () => {
  repond({ data: { metaobjects: { pageInfo: { hasNextPage: true }, edges: [
    { node: { handle: 'loup', displayName: 'Le Loup', fields: [{ key: 'fragment_audio', value: 'gid://f/1' }] } },
    { node: { handle: 'muet', displayName: 'La Muette', fields: [{ key: 'fragment_audio', value: null }] } },
  ] } } })
  expect(await lireInventaireAudio()).toEqual({
    illustrations: [{ handle: 'loup', nom: 'Le Loup', aAudio: true }, { handle: 'muet', nom: 'La Muette', aAudio: false }],
    tronque: true,
  })
})

test('l’inventaire audio vide : InventaireVide', async () => {
  repond({ data: { metaobjects: { pageInfo: { hasNextPage: false }, edges: [] } } })
  await expect(lireInventaireAudio()).rejects.toThrow('Aucune Illustration retournée par Shopify (type "illustrations") — le type a-t-il changé ?')
})

test('les produits sans Illustration : actifs seulement, métachamp vide', async () => {
  const noeud = (handle: string, status: string, value: string | null) => ({ node: { handle, title: handle.toUpperCase(), status, metafield: value === null ? null : { value } } })
  repond({ data: { products: { pageInfo: { hasNextPage: false }, edges: [noeud('a', 'ACTIVE', null), noeud('b', 'ACTIVE', 'gid://m/1'), noeud('c', 'DRAFT', null)] } } })
  expect(await lireProduitsSansIllustration()).toEqual({ produits: [{ handle: 'a', titre: 'A' }], tronque: false })
})
