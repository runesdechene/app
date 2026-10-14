import { vi } from 'vitest'
import type { Contribution, PhotoDeContribution } from './contributions'
import { delierProduit, mettreSurLaFiche, relierProduit, supprimerContribution, supprimerPhoto } from './contributions'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), retirerImage: vi.fn(), pousserImage: vi.fn(), retirerFichiers: vi.fn() }))
vi.mock('@/shared/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }))
vi.mock('./shopify', () => ({ retirerImage: mocks.retirerImage, pousserImage: mocks.pousserImage }))
vi.mock('@/shared/lib/envoi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/envoi')>()), retirerFichiers: mocks.retirerFichiers,
}))

const photo = (id: string, surcharge: Partial<PhotoDeContribution> = {}): PhotoDeContribution => ({
  id, url: `https://x/${id}.webp`, chemin: `c1/${id}.webp`, taille: 'M', produit_id: '12', produit_handle: 'veste',
  produit_titre: 'Veste', media: null, communaute: false, mur: false, ...surcharge,
})
const contribution = (images: PhotoDeContribution[]) => ({ id: 'c1', nom: 'Brune', hauteur: 183, images }) as Contribution

const ordre: string[] = []
beforeEach(() => {
  vi.resetAllMocks()
  ordre.length = 0
  mocks.rpc.mockImplementation((nom: string) => { ordre.push(nom); return Promise.resolve({ error: null }) })
  mocks.retirerImage.mockImplementation(() => { ordre.push('retirerImage'); return Promise.resolve() })
  mocks.retirerFichiers.mockImplementation(() => { ordre.push('retirerFichiers'); return Promise.resolve() })
})

describe('supprimerContribution', () => {
  const c = contribution([photo('a', { media: '99' }), photo('b')])

  test('Shopify, puis le bucket, puis la base', async () => {
    await supprimerContribution(c)
    expect(ordre).toEqual(['retirerImage', 'retirerFichiers', 'delete_photo_submission'])
    expect(mocks.retirerImage).toHaveBeenCalledTimes(1)
    expect(mocks.retirerImage).toHaveBeenCalledWith('12', '99')
    expect(mocks.retirerFichiers).toHaveBeenCalledWith('community-photos', ['c1/a.webp', 'c1/b.webp'])
    expect(mocks.rpc).toHaveBeenCalledWith('delete_photo_submission', { p_submission_id: 'c1' })
  })

  test('Shopify refuse : ni bucket ni base', async () => {
    mocks.retirerImage.mockRejectedValue(new Error('Suppression image: HTTP 500'))
    await expect(supprimerContribution(c)).rejects.toThrow('Suppression image: HTTP 500')
    expect(mocks.retirerFichiers).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('Netlify ne répond pas (404 HTML) : rien d’autre n’est supprimé', async () => {
    mocks.retirerImage.mockRejectedValue(new Error('Fiche produit Shopify : Les fonctions Netlify ne répondent pas (HTTP 404)'))
    await expect(supprimerContribution(c)).rejects.toThrow('Fiche produit Shopify')
    expect(mocks.retirerFichiers).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('une photo sans chemin : il se déduit de son adresse publique', async () => {
    await supprimerContribution(contribution([photo('a', {
      chemin: null, url: 'https://x/storage/v1/object/public/community-photos/c1/a%20b.webp?t=1',
    })]))
    expect(mocks.retirerFichiers).toHaveBeenCalledWith('community-photos', ['c1/a b.webp'])
  })

  test('le bucket refuse : la base n’est pas touchée', async () => {
    mocks.retirerFichiers.mockRejectedValue(new Error('Le fichier n’a pas pu être retiré du stockage (droits ?) : c1/a.webp'))
    await expect(supprimerContribution(c)).rejects.toThrow('droits')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  test('une adresse hors du bucket n’a rien à y retirer', async () => {
    await supprimerContribution(contribution([photo('a', { chemin: null, url: 'https://ailleurs/a.webp' })]))
    expect(mocks.retirerFichiers).toHaveBeenCalledWith('community-photos', [])
  })

  test('le refus de la base remonte', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'Réservé à l’équipe' } })
    await expect(supprimerContribution(c)).rejects.toThrow('Réservé à l’équipe')
  })
})

describe('supprimerPhoto', () => {
  test('Shopify, puis le bucket, puis delete_submission_image', async () => {
    await supprimerPhoto(photo('a', { media: '99' }))
    expect(ordre).toEqual(['retirerImage', 'retirerFichiers', 'delete_submission_image'])
    expect(mocks.rpc).toHaveBeenCalledWith('delete_submission_image', { p_image_id: 'a' })
  })

  test('sans fiche produit, Shopify n’est pas appelé', async () => {
    await supprimerPhoto(photo('a'))
    expect(mocks.retirerImage).not.toHaveBeenCalled()
  })
})

describe('les canaux et le produit', () => {
  test('relierProduit', async () => {
    await relierProduit('a', { id: '12', titre: 'Veste', handle: 'veste', image: null, prix: null })
    expect(mocks.rpc).toHaveBeenCalledWith('set_submission_image_shopify_product', {
      p_image_id: 'a', p_product_id: '12', p_handle: 'veste', p_title: 'Veste',
    })
  })

  test('délier retire d’abord l’image de Shopify', async () => {
    await delierProduit(photo('a', { media: '99' }))
    expect(ordre).toEqual(['retirerImage', 'clear_submission_image_shopify_product'])
  })

  test('mettre sur la fiche : pousse puis note le média', async () => {
    mocks.pousserImage.mockResolvedValue('77')
    await mettreSurLaFiche(contribution([]), photo('a'), true)
    expect(mocks.pousserImage).toHaveBeenCalledWith('12', 'https://x/a.webp', 'Brune mesure 1m83 et porte du M')
    expect(mocks.rpc).toHaveBeenCalledWith('set_submission_image_media', { p_image_id: 'a', p_media_id: '77' })
  })

  test('retirer de la fiche : retire puis efface le média', async () => {
    await mettreSurLaFiche(contribution([]), photo('a', { media: '99' }), false)
    expect(ordre).toEqual(['retirerImage', 'set_submission_image_media'])
    expect(mocks.rpc).toHaveBeenCalledWith('set_submission_image_media', { p_image_id: 'a', p_media_id: '' })
  })
})
