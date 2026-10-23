import { EXEMPLES, PALETTES, deduireCouleurs } from '@runes/missives'
import { vi } from 'vitest'
import { lettrePourEnvoi } from './envoi'

test('chaque photo qui penche est préparée sur la couleur du moment ; le reste ne bouge pas', async () => {
  const cuire = vi.fn((url: string, degres: number, couleur: string) => Promise.resolve(`${url}#${String(degres)}@${couleur}`))
  const lettre = { modele: 'carnet' as const, contenu: EXEMPLES.carnet }
  const pret = await lettrePourEnvoi(lettre, PALETTES.hiver, cuire)
  const fond = deduireCouleurs(PALETTES.hiver).fond
  expect(pret.modele === 'carnet' && pret.contenu.photo.url).toBe(`${EXEMPLES.carnet.photo.url}#2@${fond}`)
  expect(pret.modele === 'carnet' && pret.contenu.tirages.gauche).toBe(`${EXEMPLES.carnet.tirages.gauche}#-3@${fond}`)
  expect(pret.contenu.titre).toBe(EXEMPLES.carnet.titre)
  // Le brouillon garde ses originaux.
  expect(lettre.contenu.photo.url).toBe(EXEMPLES.carnet.photo.url)
})

test('la photo de la bande se prépare sur la couleur de rupture', async () => {
  const cuire = vi.fn((url: string, _d: number, couleur: string) => Promise.resolve(`${url}@${couleur}`))
  const pret = await lettrePourEnvoi({ modele: 'missive', contenu: EXEMPLES.missive }, PALETTES.marque, cuire)
  expect(pret.modele === 'missive' && pret.contenu.rupture.photo).toBe(`${EXEMPLES.missive.rupture.photo ?? ''}@${PALETTES.marque.rupture}`)
})

test('un Fragment aux photos droites part tel quel, sans rien préparer', async () => {
  const cuire = vi.fn()
  await lettrePourEnvoi({ modele: 'fragment', contenu: EXEMPLES.fragment }, PALETTES.marque, cuire)
  expect(cuire).not.toHaveBeenCalled()
})
