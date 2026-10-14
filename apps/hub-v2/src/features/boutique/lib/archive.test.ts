import { vi } from 'vitest'
import { fichiersDeContributions, telechargerArchive } from './archive'
import type { Contribution } from '../api/contributions'

const photo = (id: string, url: string) => ({
  id, url, chemin: null, taille: null, produit_id: null, produit_handle: null, produit_titre: null,
  media: null, communaute: false, mur: false,
})
const contribution = (nom: string, urls: string[]) => ({
  id: nom, nom, instagram: null, images: urls.map((u, i) => photo(`${nom}${String(i)}`, u)),
}) as Contribution

describe('fichiersDeContributions', () => {
  test('deux photos : « Brune - 1.webp », « Brune - 2.webp », dans l’ordre des photos', () => {
    const fichiers = fichiersDeContributions([contribution('Brune', ['https://x/a.webp', 'https://x/b.webp?t=1'])])
    expect(fichiers).toEqual([
      { url: 'https://x/a.webp', nom: 'Brune - 1.webp' },
      { url: 'https://x/b.webp?t=1', nom: 'Brune - 2.webp' },
    ])
  })

  test('plusieurs contributions : à la suite', () => {
    const fichiers = fichiersDeContributions([contribution('Brune', ['https://x/a.jpg']), contribution('Dana', ['https://x/b.mp4'])])
    expect(fichiers.map((f) => f.nom)).toEqual(['Brune - 1.jpg', 'Dana - 1.mp4'])
  })
})

describe('telechargerArchive', () => {
  const clic = vi.fn()
  beforeEach(() => {
    clic.mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clic)
  })
  afterEach(() => { vi.restoreAllMocks() })

  test('un fichier illisible est compté, pas bloquant ; un seul fichier part sans archive', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.endsWith('mauvais.webp')
      ? { ok: false } : { ok: true, blob: () => Promise.resolve(new Blob(['x'])) })))
    const progres = vi.fn()
    const bilan = await telechargerArchive([
      { url: 'https://x/bon.webp', nom: 'Brune - 1.webp' }, { url: 'https://x/mauvais.webp', nom: 'Brune - 2.webp' },
    ], 'Brune.zip', progres)
    expect(bilan).toEqual({ ok: 1, manques: 1 })
    expect(progres).toHaveBeenLastCalledWith(2, 2)
    expect(clic).toHaveBeenCalledTimes(1)
  })

  test('plusieurs fichiers : une archive', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) })))
    const bilan = await telechargerArchive([
      { url: 'https://x/a.webp', nom: 'Brune - 1.webp' }, { url: 'https://x/b.webp', nom: 'Brune - 1.webp' },
    ], 'Brune.zip')
    expect(bilan).toEqual({ ok: 2, manques: 0 })
    expect(clic).toHaveBeenCalledTimes(1)
  })
})
