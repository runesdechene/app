import { envoyerFichier, retirerFichier, verifierFichier } from './envoi'

const from = vi.hoisted(() => vi.fn())
vi.mock('@/shared/supabase/client', () => ({ supabase: { storage: { from } } }))

const MO = 1024 * 1024
const fichier = (nom: string, type: string, octets = 10) => new File([new Uint8Array(octets)], nom, { type })

describe('verifierFichier', () => {
  test('refuse un PNG de 6 Mo quand la limite est de 5 Mo', () => {
    const regle = { types: ['image/png'], maxOctets: 5 * MO }
    expect(verifierFichier(fichier('a.png', 'image/png', 6 * MO), regle)).toBe('Le fichier dépasse 5 Mo.')
  })

  test('refuse un SVG là où seuls PNG et WEBP sont permis', () => {
    const regle = { types: ['image/png', 'image/webp'] }
    expect(verifierFichier(fichier('a.svg', 'image/svg+xml'), regle)).toBe(
      'Ce type de fichier n’est pas accepté (PNG, WEBP).',
    )
  })

  test('rend null pour un fichier conforme', () => {
    const regle = { types: ['image/png'], maxOctets: 5 * MO }
    expect(verifierFichier(fichier('a.png', 'image/png', 1 * MO), regle)).toBeNull()
  })
})

describe('envoyerFichier et retirerFichier', () => {
  const upload = vi.fn()
  const remove = vi.fn()
  const getPublicUrl = vi.fn()

  beforeEach(() => {
    from.mockReturnValue({ upload, remove, getPublicUrl })
    upload.mockResolvedValue({ error: null })
    remove.mockResolvedValue({ error: null })
    getPublicUrl.mockImplementation((chemin: string) => ({
      data: { publicUrl: `http://localhost/storage/v1/object/public/home-banners/${chemin}` },
    }))
  })

  afterEach(() => vi.clearAllMocks())

  test('envoie sous le chemin donné, avec le type du fichier, et rend l’adresse publique', async () => {
    const f = fichier('a.png', 'image/png')
    const adresse = await envoyerFichier('home-banners', 'x/a.png', f)
    expect(from).toHaveBeenCalledWith('home-banners')
    expect(upload).toHaveBeenCalledWith('x/a.png', f, { contentType: 'image/png', upsert: true })
    expect(adresse).toBe('http://localhost/storage/v1/object/public/home-banners/x/a.png')
  })

  test('lève l’erreur du stockage', async () => {
    upload.mockResolvedValue({ error: new Error('refusé') })
    await expect(envoyerFichier('home-banners', 'x/a.png', fichier('a.png', 'image/png'))).rejects.toThrow('refusé')
  })

  test('retire le fichier dont le chemin se déduit de l’adresse publique', async () => {
    await retirerFichier('home-banners', 'http://localhost/storage/v1/object/public/home-banners/x/a.png')
    expect(remove).toHaveBeenCalledWith(['x/a.png'])
  })

  test('ne fait rien si l’adresse n’est pas de ce bucket', async () => {
    await retirerFichier('home-banners', 'http://localhost/storage/v1/object/public/tag-icons/a.svg')
    expect(remove).not.toHaveBeenCalled()
  })

  test('lève une vraie erreur de suppression', async () => {
    remove.mockResolvedValue({ error: new Error('boum') })
    await expect(
      retirerFichier('home-banners', 'http://localhost/storage/v1/object/public/home-banners/a.png'),
    ).rejects.toThrow('boum')
  })
})
