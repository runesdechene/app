import { vi } from 'vitest'
import { AccesShopifyRefuse, graphqlShopify, lireIllustrations } from './shopify'

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
