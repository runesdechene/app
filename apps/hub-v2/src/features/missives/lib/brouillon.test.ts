import { PALETTES } from '@runes/missives'
import { ajouterNouvelle, brouillonVide, changerModele, changerZone, deplacerNouvelle, supprimerNouvelle } from './brouillon'

test('une Missive neuve part du modèle et de ses trois nouvelles, aux couleurs de la marque', () => {
  const b = brouillonVide('missive')
  expect(b.lettre.modele).toBe('missive')
  expect(b.lettre.modele === 'missive' && b.lettre.contenu.nouvelles).toHaveLength(3)
  expect(b.couleurs).toEqual(PALETTES.marque)
  expect(b.id).toBeNull()
})

test('changer une zone, même profonde, ne touche qu’à elle', () => {
  const avant = brouillonVide('missive')
  const apres = changerZone(avant, 'nouvelles.1.titre', 'LE CAMION EST PRÊT')
  expect(apres.lettre.modele === 'missive' && apres.lettre.contenu.nouvelles[1]?.titre).toBe('LE CAMION EST PRÊT')
  expect(avant.lettre.modele === 'missive' && avant.lettre.contenu.nouvelles[1]?.titre).not.toBe('LE CAMION EST PRÊT')
  expect(changerZone(avant, 'titre', 'NEIGE').lettre.contenu.titre).toBe('NEIGE')
})

test('cinq nouvelles au plus, une au moins', () => {
  let b = brouillonVide('missive')
  b = ajouterNouvelle(ajouterNouvelle(b))
  expect(b.lettre.modele === 'missive' && b.lettre.contenu.nouvelles).toHaveLength(5)
  expect(ajouterNouvelle(b)).toBe(b)
  let seule = brouillonVide('missive')
  seule = supprimerNouvelle(supprimerNouvelle(seule, 0), 0)
  expect(supprimerNouvelle(seule, 0)).toBe(seule)
})

test('déplacer la troisième nouvelle en tête', () => {
  const b = changerZone(brouillonVide('missive'), 'nouvelles.2.titre', 'TROISIÈME')
  const apres = deplacerNouvelle(b, 2, 0)
  expect(apres.lettre.modele === 'missive' && apres.lettre.contenu.nouvelles[0]?.titre).toBe('TROISIÈME')
})

test('changer de modèle garde l’objet, l’aperçu, la liste et les couleurs', () => {
  const b = { ...brouillonVide('missive'), objet: 'Hécate est là', apercu: 'Le drop de novembre', liste: 'porteurs' as const, couleurs: PALETTES.hiver }
  const apres = changerModele(b, 'fragment')
  expect(apres.lettre.modele).toBe('fragment')
  expect(apres).toMatchObject({ objet: 'Hécate est là', apercu: 'Le drop de novembre', liste: 'porteurs', couleurs: PALETTES.hiver })
})
