/**
 * QUOI     — écrire le contenu d'un motif dans son métaobjet Shopify (préhistoire, mot de l'artiste,
 *            marque d'édition).
 */
import { vi } from 'vitest'
import { ecrireContenuMotif } from './contenuMotif'

const appel = vi.hoisted(() => ({ appelerFonction: vi.fn(), lireReponse: vi.fn() }))
vi.mock('@/shared/lib/fonctions', () => appel)

beforeEach(() => {
  vi.resetAllMocks()
  appel.appelerFonction.mockResolvedValue({})
})

const champs = { resume: 'Ils tenaient la ligne.', mot_de_l_artiste: 'Deux soirées.', edition: 'limitee' as const, edition_precision: '' }

test('un metaobjectUpsert sur l’Illustration, avec les quatre champs', async () => {
  appel.lireReponse.mockResolvedValue({ data: { metaobjectUpsert: { userErrors: [] } } })
  await ecrireContenuMotif('hoplite', champs)
  const [, init] = appel.appelerFonction.mock.calls[0] as [string, { corps: { query: string } }]
  expect(init.corps.query).toContain('metaobjectUpsert')
  expect(init.corps.query).toContain('type: "illustrations", handle: "hoplite"')
  for (const cle of ['resume', 'mot_de_l_artiste', 'edition', 'edition_precision']) {
    expect(init.corps.query).toContain(`key: "${cle}"`)
  }
})

test('un userErrors de Shopify remonte tel quel', async () => {
  appel.lireReponse.mockResolvedValue({
    data: { metaobjectUpsert: { userErrors: [{ field: ['fields'], message: 'Field definition "mot_de_l_artiste" does not exist' }] } },
  })
  await expect(ecrireContenuMotif('hoplite', champs)).rejects.toThrow('Field definition "mot_de_l_artiste" does not exist')
})
