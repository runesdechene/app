import { vi } from 'vitest'
import { photographierTitres } from './titres'

test('chaque titre marqué de la lettre est photographié, déposé, et retrouvé par sa zone', async () => {
  const racine = document.createElement('div')
  racine.innerHTML = '<h1><span data-titre="titre">LOKI</span></h1><p><span data-titre="signature">URIEL</span></p><p>texte</p>'
  const capturer = vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' })))
  const deposer = vi.fn(() => Promise.resolve(`https://stockage/${String(deposer.mock.calls.length)}.png`))
  const titres = await photographierTitres(racine, deposer, capturer)
  expect(capturer).toHaveBeenCalledTimes(2)
  expect(Object.keys(titres)).toEqual(['titre', 'signature'])
  expect(titres.titre?.src).toBe('https://stockage/1.png')
})
