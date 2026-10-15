import { expect, test } from 'vitest'
import { versHtml } from './markdown'

test('un <script> dans le texte disparaît', () => {
  const html = versHtml('Salut <script>alert(1)</script> à tous')
  expect(html).not.toContain('<script')
  expect(html).not.toContain('alert(1)')
})

test('une liste et un gras sortent en HTML', () => {
  const html = versHtml('**Bonjour**\n\n- un\n- deux')
  expect(html).toContain('<strong>Bonjour</strong>')
  expect(html).toContain('<li>un</li>')
})

test('un appel http(s) ajoute un lien-bouton à la fin', () => {
  const html = versHtml('Texte', { url: 'https://runesdechene.com/x', libelle: 'Voir' })
  expect(html).toMatch(/<a [^>]*href="https:\/\/runesdechene\.com\/x"[^>]*>Voir<\/a><\/p>\s*$/)
})

test('un appel javascript: est ignoré', () => {
  const html = versHtml('Texte', { url: 'javascript:alert(1)', libelle: 'Piège' })
  expect(html).not.toContain('javascript:')
  expect(html).not.toContain('Piège')
})
