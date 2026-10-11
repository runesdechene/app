/**
 * QUOI     — la vitrine rendue pour Google : le texte, les vrais chiffres et les natures sont
 *            dans le HTML, sans JavaScript ; l'activité vivante n'y est pas.
 */
import { expect, test, vi } from 'vitest'
import { rendreVitrine } from './vitrine'

vi.mock('@/features/vitrine/api/vitrine', () => ({
  fetchChiffres: vi.fn().mockResolvedValue({ lieux: 3068, explorateurs: 4750 }),
  fetchNatures: vi
    .fn()
    .mockResolvedValue([
      { id: 'n1', nom: 'Dolmens & mégalithes', icone: null, couleur: null, nombre: 37 },
    ]),
  fetchActivite: vi.fn(),
  fetchLieuxAuHasard: vi.fn().mockResolvedValue([
    {
      id: 'l1',
      nom: 'Abbaye de Fontfroide',
      slug: 'abbaye-de-fontfroide',
      region: 'Aude',
      numero: '11',
      nature: null,
      photo: 'https://exemple.fr/photo.webp',
      auteur: { nom: 'Uriel', avatar: null },
    },
  ]),
  fetchConnecte: vi.fn(),
  chercher: vi.fn(),
  fetchApercu: vi.fn(),
}))

test('la vitrine rendue porte son texte, ses chiffres et ses natures', async () => {
  const html = (await rendreVitrine()).replace(/\s/g, ' ')
  expect(html).toContain('lieux insolites, anciens et oubliés')
  expect(html).toContain('3 068')
  expect(html).toContain('Dolmens &amp; mégalithes')
  expect(html).toContain('Runes de Chêne')
  expect(html).toContain('href="/lieu/abbaye-de-fontfroide"')
  expect(html).not.toContain('vient de découvrir')
})

// Le titre et la description sont déjà dans l'en-tête de index.html : pas de doublon dans le corps.
test('la vitrine rendue ne répète pas le titre ni la description', async () => {
  const html = await rendreVitrine()
  expect(html).not.toContain('<title>')
  expect(html).not.toContain('name="description"')
})
