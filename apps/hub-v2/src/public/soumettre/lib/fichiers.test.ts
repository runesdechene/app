/**
 * QUOI     — ce que le formulaire refuse avant tout envoi : trop lourd, mauvais type, un fichier de trop.
 * POURQUOI — chaque refus dit au joueur quel fichier et pourquoi, avant qu'un octet ne parte.
 */
import { describe, expect, it } from 'vitest'
import { MAX_FICHIERS, refusDuFichier, trierLesAjouts } from './fichiers'

const MO = 1024 * 1024

function fichier(nom: string, type: string, mo = 1): File {
  const f = new File(['x'], nom, { type })
  Object.defineProperty(f, 'size', { value: mo * MO })
  return f
}

describe('refusDuFichier', () => {
  it('refuse une image de 16 Mo, en nommant le fichier', () => {
    expect(refusDuFichier(fichier('sommet.jpg', 'image/jpeg', 16))).toBe(
      '« sommet.jpg » fait 16,0 Mo : la limite est de 15 Mo pour une photo.',
    )
  })

  it('accepte une vidéo de 49 Mo et refuse celle de 51 Mo', () => {
    expect(refusDuFichier(fichier('marche.mp4', 'video/mp4', 49))).toBeNull()
    expect(refusDuFichier(fichier('marche.mov', 'video/quicktime', 51))).toBe(
      '« marche.mov » fait 51,0 Mo : la limite est de 50 Mo pour une vidéo.',
    )
  })

  it('refuse un .gif', () => {
    expect(refusDuFichier(fichier('danse.gif', 'image/gif'))).toBe(
      '« danse.gif » n’est pas accepté : photos JPG, PNG, WebP ou HEIC, vidéos MP4, MOV, WebM ou M4V.',
    )
  })

  it.each([
    ['a.jpg', 'image/jpeg'],
    ['a.jpeg', 'image/jpeg'],
    ['a.png', 'image/png'],
    ['a.webp', 'image/webp'],
    ['a.heic', 'image/heic'],
    ['a.HEIF', ''],
    ['a.mp4', 'video/mp4'],
    ['a.mov', 'video/quicktime'],
    ['a.webm', 'video/webm'],
    ['a.m4v', 'video/x-m4v'],
  ])('accepte %s', (nom, type) => {
    expect(refusDuFichier(fichier(nom, type))).toBeNull()
  })
})

describe('trierLesAjouts', () => {
  it(`refuse le fichier au-delà de ${String(MAX_FICHIERS)}`, () => {
    const { acceptes, refus } = trierLesAjouts(10, [fichier('onzieme.jpg', 'image/jpeg')])
    expect(acceptes).toEqual([])
    expect(refus).toEqual(['« onzieme.jpg » n’est pas ajouté : 10 contenus au plus.'])
  })

  it('garde les bons, écarte les mauvais avec leur raison', () => {
    const bon = fichier('bon.png', 'image/png')
    const { acceptes, refus } = trierLesAjouts(0, [bon, fichier('danse.gif', 'image/gif')])
    expect(acceptes).toEqual([bon])
    expect(refus).toHaveLength(1)
  })
})
