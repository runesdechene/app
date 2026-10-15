import { degradeDeVoile, lienValide, ombreDeTexte } from './banniere'

test('le dégradé : plein à gauche, 0,5/0,85 à 60 %, 0,2/0,85 à droite (comme la V2)', () => {
  expect(degradeDeVoile('#ff8000', 0.85)).toBe(
    'linear-gradient(90deg, rgba(255,128,0,0.85) 0%, rgba(255,128,0,0.5) 60%, rgba(255,128,0,0.2) 100%)',
  )
})

test('le dégradé : l’opacité est bornée entre 0 et 1, une couleur illisible donne du noir', () => {
  expect(degradeDeVoile('#000000', 3)).toContain('rgba(0,0,0,1) 0%')
  expect(degradeDeVoile('#000000', -1)).toContain('rgba(0,0,0,0) 0%')
  expect(degradeDeVoile('rouge', 1)).toContain('rgba(0,0,0,1) 0%')
})

test('l’ombre : « none » à force nulle, sinon 0 1px 3px dans la couleur', () => {
  expect(ombreDeTexte('#102030', 0)).toBe('none')
  expect(ombreDeTexte('#102030', 0.6)).toBe('0 1px 3px rgba(16,32,48,0.6)')
  expect(ombreDeTexte('#102030', 9)).toBe('0 1px 3px rgba(16,32,48,1)')
})

test('un lien valide commence par http:// ou https://', () => {
  expect(lienValide('https://runesdechene.com/collections/x')).toBe(true)
  expect(lienValide('http://exemple.fr')).toBe(true)
  expect(lienValide('runesdechene.com')).toBe(false)
  expect(lienValide('javascript:alert(1)')).toBe(false)
  expect(lienValide('')).toBe(false)
  expect(lienValide('https://')).toBe(false)
  expect(lienValide('https://runesdechene.com')).toBe(true)
})
