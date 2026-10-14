import { estUneVideo, nomDeFichier, texteAlternatif } from './contribution'

test('le texte alternatif de Shopify, comme l’ancien Hub', () => {
  expect(texteAlternatif('Pierre', 183, 'M')).toBe('Pierre mesure 1m83 et porte du M')
  expect(texteAlternatif('Pierre', 183, 'none')).toBe('Pierre mesure 1m83')
  expect(texteAlternatif('Pierre', null, 'L')).toBe('Pierre porte du L')
  expect(texteAlternatif('  ', null, null)).toBe('Communauté Runes de Chêne')
})
test('le nom d’un fichier téléchargé', () => {
  expect(nomDeFichier('Brune / K.', '@brune', 0, 'https://x.supabase.co/a/b.jpg?t=1')).toBe('Brune K. - @brune - 1.jpg')
  expect(nomDeFichier('Brune', null, 2, 'https://x/c')).toBe('Brune - 3.webp')
})
test('une vidéo se reconnaît à son extension', () => {
  expect(estUneVideo('https://x/a.MOV')).toBe(true)
  expect(estUneVideo('https://x/a.webp')).toBe(false)
})
