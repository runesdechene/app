import { act, renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { useIconeEnvoyee } from './useIconeEnvoyee'

const mockEnvoyer = vi.hoisted(() => vi.fn())
const mockRetirer = vi.hoisted(() => vi.fn())
vi.mock('@/shared/lib/envoi', async (orig) => ({
  ...(await orig<typeof import('@/shared/lib/envoi')>()), envoyerFichier: mockEnvoyer, retirerFichier: mockRetirer,
}))

const REGLE = { types: ['image/svg+xml'] }
const chemin = () => 'a.svg'
const ENREGISTREE = 'https://x.test/storage/v1/object/public/tag-icons/ancienne.svg'

// Un vrai champ fichier, auquel on donne le fichier choisi.
function champ(fichier: File) {
  const input = document.createElement('input')
  Object.defineProperty(input, 'files', { value: [fichier] })
  return { target: input }
}
const svg = () => new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' })

beforeEach(() => {
  vi.clearAllMocks()
  mockRetirer.mockResolvedValue(undefined)
})

test('au départ, l’icône est celle qui est enregistrée', () => {
  const { result } = renderHook(() => useIconeEnvoyee('tag-icons', ENREGISTREE))
  expect(result.current.icone).toBe(ENREGISTREE)
})

test('un fichier refusé : le refus reste, rien n’est envoyé', async () => {
  const { result } = renderHook(() => useIconeEnvoyee('tag-icons', null))
  await act(() => result.current.choisir(champ(new File(['x'], 'a.png', { type: 'image/png' })), REGLE, chemin))
  expect(result.current.refus).toContain('Ce type de fichier n’est pas accepté')
  expect(mockEnvoyer).not.toHaveBeenCalled()
})

test('l’envoi est signalé en cours, puis l’adresse devient l’icône', async () => {
  let fini: (adresse: string) => void = () => undefined
  mockEnvoyer.mockReturnValue(new Promise<string>((ok) => { fini = ok }))
  const { result } = renderHook(() => useIconeEnvoyee('tag-icons', null))
  let envoi = Promise.resolve()
  act(() => { envoi = result.current.choisir(champ(svg()), REGLE, chemin) })
  expect(result.current.envoiEnCours).toBe(true)
  await act(async () => { fini('https://x.test/nouvelle.svg'); await envoi })
  expect(result.current.envoiEnCours).toBe(false)
  expect(result.current.icone).toBe('https://x.test/nouvelle.svg')
})

test('le champ est vidé après chaque choix : le même fichier peut être rechoisi', async () => {
  const { result } = renderHook(() => useIconeEnvoyee('tag-icons', null))
  const evenement = champ(new File(['x'], 'a.png', { type: 'image/png' }))
  evenement.target.value = ''
  const vide = vi.spyOn(evenement.target, 'value', 'set')
  await act(() => result.current.choisir(evenement, REGLE, chemin))
  expect(vide).toHaveBeenCalledWith('')
})

test('une icône envoyée puis remplacée avant d’enregistrer est retirée, jamais l’enregistrée', async () => {
  mockEnvoyer.mockResolvedValueOnce('https://x.test/un.svg').mockResolvedValueOnce('https://x.test/deux.svg')
  const { result } = renderHook(() => useIconeEnvoyee('tag-icons', ENREGISTREE))
  await act(() => result.current.choisir(champ(svg()), REGLE, chemin))
  expect(mockRetirer).not.toHaveBeenCalled()
  await act(() => result.current.choisir(champ(svg()), REGLE, chemin))
  expect(mockRetirer).toHaveBeenCalledTimes(1)
  expect(mockRetirer).toHaveBeenCalledWith('tag-icons', 'https://x.test/un.svg')
})

test('l’ancienne icône enregistrée n’est retirée qu’après l’enregistrement', async () => {
  mockEnvoyer.mockResolvedValue('https://x.test/un.svg')
  const { result } = renderHook(() => useIconeEnvoyee('tag-icons', ENREGISTREE))
  await act(() => result.current.choisir(champ(svg()), REGLE, chemin))
  expect(mockRetirer).not.toHaveBeenCalled()
  act(() => { result.current.apresEnregistrement() })
  expect(mockRetirer).toHaveBeenCalledWith('tag-icons', ENREGISTREE)
})

test('enregistrer sans avoir changé d’icône ne retire rien', () => {
  const { result } = renderHook(() => useIconeEnvoyee('tag-icons', ENREGISTREE))
  act(() => { result.current.apresEnregistrement() })
  expect(mockRetirer).not.toHaveBeenCalled()
})

test('un envoi qui échoue : le message de l’erreur, l’icône inchangée', async () => {
  mockEnvoyer.mockRejectedValue(new Error('Bucket plein'))
  const { result } = renderHook(() => useIconeEnvoyee('tag-icons', null))
  await act(() => result.current.choisir(champ(svg()), REGLE, chemin))
  expect(result.current.refus).toBe('Bucket plein')
  expect(result.current.icone).toBe('')
  expect(result.current.envoiEnCours).toBe(false)
})
