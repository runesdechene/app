import { estUnFragment, motifsSansFragment } from './motifs'

const hoplite = { shopify_handle: 'hoplite', link_url: 'https://runesdechene.com/collections/Hoplite' }
test('relié par son métaobjet', () => {
  expect(estUnFragment({ handle: 'hoplite', collection: '' }, [hoplite])).toBe(true)
})
test('relié par la collection de son lien, sans tenir compte de la casse', () => {
  expect(estUnFragment({ handle: 'autre', collection: 'hoplite' }, [{ shopify_handle: null, link_url: hoplite.link_url }])).toBe(true)
})
test('une collection vide ne relie rien', () => {
  expect(estUnFragment({ handle: 'x', collection: '' }, [{ shopify_handle: null, link_url: null }])).toBe(false)
})
test('les motifs sans Fragment', () => {
  expect(motifsSansFragment([{ handle: 'hoplite', collection: '' }, { handle: 'loup', collection: 'loup' }], [hoplite]).map((m) => m.handle)).toEqual(['loup'])
})
