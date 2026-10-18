import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { miseEnForme, periodeValide, secretValide } from './reponse.ts'

Deno.test('les quatre périodes passent, le reste est refusé', () => {
  for (const p of ['jour', 'semaine', 'mois', 'toujours']) assertEquals(periodeValide(p), true)
  for (const p of ['annee', '', null, 7]) assertEquals(periodeValide(p), false)
})

Deno.test('toujours : avant reste null', () => {
  const r = miseEnForme('toujours', { pouls: { nouveaux: 3, reactives: 34, actifs: 48, lieux: 6, visites: 5, enigmes: 89 }, avant: null }, '2026-10-18T09:00:00Z')
  assertEquals(r.avant, null)
  assertEquals(r.pouls.actifs, 48)
})

Deno.test('un avant non nul passe tel quel, sans la clé actifs', () => {
  const avant = { nouveaux: 10, reactives: 4, lieux: 5, visites: 30, enigmes: 80 }
  const r = miseEnForme('semaine', { pouls: { nouveaux: 12, reactives: 3, actifs: 40, lieux: 7, visites: 21, enigmes: 89 }, avant }, '2026-10-18T09:00:00Z')
  assertEquals(r.avant, avant)
})

Deno.test('un compteur non numérique est une erreur, pas un zéro', () => {
  assertThrows(() => miseEnForme('semaine', { pouls: { nouveaux: '12', reactives: 3, actifs: 40, lieux: 7, visites: 21, enigmes: 89 }, avant: null }, '2026-10-18T09:00:00Z'))
})

Deno.test('un jsonb sans la clé pouls est une erreur, pas un objet vide', () => {
  assertThrows(() => miseEnForme('semaine', {}, '2026-10-18T09:00:00Z'))
})

Deno.test('un secret absent, vide ou faux est refusé', () => {
  assertEquals(secretValide('bon', 'bon'), true)
  assertEquals(secretValide('mauvais', 'bon'), false)
  assertEquals(secretValide('', 'bon'), false)
  assertEquals(secretValide(null, 'bon'), false)
})
