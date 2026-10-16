/**
 * QUOI     — le dépôt d'un fichier : son chemin et le type envoyé au stockage.
 * POURQUOI — un téléphone donne souvent un type vide (HEIC, m4v) ; le bucket refuse un type qu'il ne
 *            connaît pas (mig 331). Le type vient donc de l'extension, jamais d'un `f.type` vide.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { envoyerFichierPublic } from './api'

const { upload } = vi.hoisted(() => ({
  upload: vi.fn<(chemin: string, f: File, options: object) => Promise<{ data: object; error: null }>>(),
}))

vi.mock('@/shared/supabase/client', () => ({
  supabase: { storage: { from: () => ({ upload }) } },
}))

beforeEach(() => {
  upload.mockReset().mockResolvedValue({ data: {}, error: null })
})

describe('envoyerFichierPublic', () => {
  it.each([
    ['clip.m4v', 'video/mp4'],
    ['sommet.heic', 'image/heic'],
    ['sommet.HEIF', 'image/heif'],
    ['marche.mov', 'video/quicktime'],
    ['sommet.webp', 'image/webp'],
  ])('%s au type vide part en %s', async (nom, type) => {
    const chemin = await envoyerFichierPublic(new File(['x'], nom, { type: '' }), 'dossier')
    expect(chemin).toMatch(/^submissions\/dossier\/[0-9a-f-]{36}\.[a-z0-9]+$/)
    expect(upload).toHaveBeenCalledWith(chemin, expect.any(File), { contentType: type, upsert: false })
  })
})
