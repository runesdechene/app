import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { formatPayload } from './payloads.ts'

Deno.test('daily_enigma_ready payload is constant', () => {
  const p = formatPayload('daily_enigma_ready', {})
  assertEquals(p?.title, 'Ton énigme du jour')
  assertEquals(p?.url,   '/?enigma=daily')
})

Deno.test('expedition_message uses author + expedition_name', () => {
  const p = formatPayload('expedition_message', {
    author_name: 'Marin',
    expedition_id: '42',
    expedition_name: 'Forêt de Brocéliande',
    preview: 'On part demain à 8h',
  })
  assertEquals(p?.title, 'Message — Forêt de Brocéliande')
  assertEquals(p?.body,  'Marin : On part demain à 8h')
  assertEquals(p?.url,   '/?expedition=42')
})

Deno.test('expedition_message handles missing preview gracefully', () => {
  const p = formatPayload('expedition_message', {
    author_name: 'Marin',
    expedition_id: '42',
    expedition_name: 'Forêt',
  })
  assertEquals(p?.body, 'Marin a écrit.')
})

Deno.test('place_taken_remote vs place_reaffirmed have different titles', () => {
  const taken = formatPayload('place_taken_remote', { place_name: 'Pic du Midi', place_id: '1' })
  const reaff = formatPayload('place_reaffirmed', { place_name: 'Pic du Midi', place_id: '1' })
  assertNotEquals(taken?.title, reaff?.title)
})

Deno.test('level_up_imminent formats xp_diff and next_level', () => {
  const p = formatPayload('level_up_imminent', { xp_diff: 3, next_level: 12 })
  assertEquals(p?.title, 'Plus que 3 XP avant niveau 12')
})

Deno.test('weekly_new_places_recap with samples', () => {
  const p = formatPayload('weekly_new_places_recap', { count: 7, sample_names_csv: 'A, B, C' })
  assertEquals(p?.title, '7 nouveaux lieux cette semaine')
})

Deno.test('weekly_new_places_recap without samples falls back', () => {
  const p = formatPayload('weekly_new_places_recap', { count: 5 })
  assertEquals(p?.body, 'Découvre la nouvelle carte.')
})

Deno.test('unknown type returns null', () => {
  assertEquals(formatPayload('court_attack', {}), null)
})
