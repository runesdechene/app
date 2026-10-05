/**
 * QUOI     — toute variable CSS utilisée dans la V2 doit exister dans tokens.css.
 * POURQUOI — une variable inconnue ne casse rien à la compilation : le navigateur l'ignore et
 *            l'élément perd son style en silence. Stylelint ne le voit pas ; ce test, si.
 * ATTENTION — les variables posées en style inline (ex. '--avatar') sont déclarées dans
 *            PASSED_INLINE : elles viennent du composant, pas des jetons.
 *            Lecture sur disque (node:fs) : Vitest ne livre pas le texte brut d'un .css importé.
 */
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { ENCRE, FOND } from '../lib/teinte'

const SRC = path.resolve(import.meta.dirname, '../..')
const PASSED_INLINE = new Set([
  '--avatar',
  '--nuance',
  '--mesure',
  '--icone',
  '--nombre',
  '--rang',
  '--type',
  '--avant',
  '--voile',
  '--voile-force',
  '--teinte-tag',
  '--teinte-titre',
  '--teinte-sous-titre',
  '--ombre-texte',
  '--ombre-force',
  '--couleur', // la couleur d'une Compagnie (mig 422)
  '--encre-compagnie', // son encre lisible (shared/lib/teinte.ts)
  '--sur-couleur',
])

const cssFiles = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.css'))
  .map((file) => path.join(SRC, file))

const tokens = readFileSync(path.join(SRC, 'shared/styles/tokens.css'), 'utf8')
const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]))

test('les jetons sont lus', () => {
  expect(defined.has('--color-fond')).toBe(true)
})

test('chaque var(--…) utilisée est définie dans tokens.css', () => {
  const unknown: string[] = []
  for (const file of cssFiles) {
    for (const [, name] of readFileSync(file, 'utf8').matchAll(/var\((--[a-z0-9-]+)/g)) {
      if (name && !defined.has(name) && !PASSED_INLINE.has(name)) {
        unknown.push(`${path.relative(SRC, file)} → ${name}`)
      }
    }
  }
  expect(unknown).toEqual([])
})

test('la teinte des Compagnies recopie le fond et l’encre des jetons', () => {
  expect(tokens).toContain(`--color-fond: ${FOND};`)
  expect(tokens).toContain(`--color-encre: ${ENCRE};`)
})
