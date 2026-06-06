import { describe, it, expect } from 'vitest'
import { renderMarkdown, excerpt } from './markdown'

describe('renderMarkdown', () => {
  it('rend le gras et les titres', () => {
    const html = renderMarkdown('# Titre\n\nUn **mot** fort.')
    expect(html).toContain('<h1>Titre</h1>')
    expect(html).toContain('<strong>mot</strong>')
  })
  it('gère une entrée vide', () => {
    expect(renderMarkdown('')).toBe('')
  })
})

describe('excerpt', () => {
  it('retire la syntaxe markdown et garde le texte', () => {
    expect(excerpt('# Bonjour **monde**')).toBe('Bonjour monde')
  })
  it('borne la longueur avec une ellipse', () => {
    expect(excerpt('a'.repeat(200)).endsWith('…')).toBe(true)
  })
  it('garde le texte des liens', () => {
    expect(excerpt('Voir [la boutique](https://x.com)')).toContain('la boutique')
  })
})
