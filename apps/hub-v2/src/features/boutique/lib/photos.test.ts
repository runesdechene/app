import { describe, expect, it } from 'vitest'
import type { PhotoPubliee } from '../api/photos'
import { selonPlacement } from './photos'

const photo = (id: string, endroits: Partial<Pick<PhotoPubliee, 'fiche' | 'mur' | 'communaute'>>): PhotoPubliee => ({
  id, url: `https://x/${id}.webp`, contribution: 'c', nom: 'Kelly', statut: 'approved', quand: null,
  produit_titre: null, fiche: false, mur: false, communaute: false, ...endroits,
})

describe('selonPlacement', () => {
  const photos = [photo('fiche', { fiche: true }), photo('mur', { mur: true }), photo('communaute', { communaute: true }), photo('nulle', {})]

  it('une photo sur la fiche, au mur ou dans la communauté est placée', () => {
    expect(selonPlacement(photos, 'placees').map((p) => p.id)).toEqual(['fiche', 'mur', 'communaute'])
  })

  it('une photo publiée nulle part ne l’est pas', () => {
    expect(selonPlacement(photos, 'non_placees').map((p) => p.id)).toEqual(['nulle'])
  })

  it('« Toutes » les garde toutes', () => {
    expect(selonPlacement(photos, 'toutes')).toHaveLength(4)
  })
})
