/**
 * QUOI     — la liste des couleurs montrées sur /v2/da est exactement celle de tokens.css.
 * POURQUOI — une couleur ajoutée aux jetons sans passer par la page ferait un élément caché.
 */
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { COLOR_TOKENS } from './daTokens'

test('COLOR_TOKENS reprend toutes les couleurs de tokens.css, et elles seules', () => {
  const tokens = readFileSync(
    path.resolve(import.meta.dirname, '../../shared/styles/tokens.css'),
    'utf8',
  )
  const declared = [...tokens.matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((m) => m[1])
  expect([...COLOR_TOKENS].sort()).toEqual(declared.sort())
})
