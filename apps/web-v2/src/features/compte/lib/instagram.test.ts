import { expect, test } from 'vitest'
import { pseudoInstagram } from './instagram'

test('le « @ » tapé par erreur et les espaces autour disparaissent', () => {
  expect(pseudoInstagram('@laurene.sv')).toBe('laurene.sv')
  expect(pseudoInstagram('  @@jordanephotography22 ')).toBe('jordanephotography22')
  expect(pseudoInstagram('runesdechene')).toBe('runesdechene')
})

test('une adresse collée donne le pseudo', () => {
  expect(pseudoInstagram('https://www.instagram.com/runesdechene/')).toBe('runesdechene')
  expect(pseudoInstagram('instagram.com/runes_de_chene?igsh=abc')).toBe('runes_de_chene')
})

test('ce qui n’est pas un pseudo ne donne rien : pas de lien cassé', () => {
  expect(pseudoInstagram('Gautier de Bilskirnir')).toBeNull()
  expect(pseudoInstagram('@')).toBeNull()
  expect(pseudoInstagram('')).toBeNull()
  expect(pseudoInstagram(null)).toBeNull()
})
