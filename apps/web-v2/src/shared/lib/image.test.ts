import { expect, test } from 'vitest'
import { aLaTaille } from './image'

const BASE = 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1'

test('une image de Supabase passe par le redimensionnement, au double de la taille affichée', () => {
  expect(aLaTaille(`${BASE}/object/public/home-banners/b.jpg`, 400)).toBe(
    `${BASE}/render/image/public/home-banners/b.jpg?width=800&quality=70&resize=contain`,
  )
})

test('ses paramètres sont gardés (le ?t= qui force le rafraîchissement d’un avatar)', () => {
  expect(aLaTaille(`${BASE}/object/public/place-images/u/avatar.webp?t=123`, 32)).toBe(
    `${BASE}/render/image/public/place-images/u/avatar.webp?t=123&width=64&quality=70&resize=contain`,
  )
})

test('les proportions sont gardées : sans « contain », Supabase garde la hauteur d’origine et recadre', () => {
  expect(aLaTaille(`${BASE}/object/public/app-fragments/f.webp`, 104)).toContain('resize=contain')
})

test('jamais plus de 2 000 px, et les autres adresses restent telles quelles', () => {
  expect(aLaTaille(`${BASE}/object/public/a/b.jpg`, 1600)).toContain('width=2000')
  expect(aLaTaille('https://exemple.fr/photo.jpg', 100)).toBe('https://exemple.fr/photo.jpg')
  expect(aLaTaille('blob:http://localhost/123', 100)).toBe('blob:http://localhost/123')
  expect(aLaTaille(null, 100)).toBeNull()
})

test('une photo de lieu, déjà réduite à l’envoi, est servie telle quelle : sa vignette en petit, la grande sinon', () => {
  const grande = `${BASE}/object/public/place-images/places/u1/abc.webp`
  const vignette = `${BASE}/object/public/place-images/places/u1/abc_thumb.webp`
  expect(aLaTaille(grande, 56)).toBe(vignette)
  expect(aLaTaille(vignette, 56)).toBe(vignette)
  expect(aLaTaille(grande, 1000)).toBe(grande)
  expect(aLaTaille(`${BASE}/object/public/place-images/rapatrie/x.webp`, 300)).toBe(
    `${BASE}/object/public/place-images/rapatrie/x_thumb.webp`,
  )
  // Pas encore rattrapée (JPEG) : redimensionnée comme avant.
  expect(aLaTaille(`${BASE}/object/public/place-images/rapatrie/x.jpeg`, 300)).toContain('/render/image/')
})

test('une image de Shopify est redimensionnée par son CDN, au double de la taille affichée', () => {
  expect(aLaTaille('https://cdn.shopify.com/s/files/1/0728/files/illu.webp?v=17', 48)).toBe(
    'https://cdn.shopify.com/s/files/1/0728/files/illu.webp?v=17&width=96',
  )
  expect(aLaTaille('https://cdn.shopify.com/s/files/illu.png', 300)).toBe(
    'https://cdn.shopify.com/s/files/illu.png?width=600',
  )
})
