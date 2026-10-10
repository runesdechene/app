/**
 * QUOI     — la frise : l'en-tête suit la plage, une poignée ne dépasse pas l'autre, « Tout »
 *            remet au repos, rien ne s'affiche sans époques datées.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { EpoqueFiltre } from '../api/lireCarte'
import { FriseDesEpoques } from './FriseDesEpoques'

vi.mock('@/shared/hooks/useCalendrier', () => ({ useCalendrier: () => 'rome' }))

const e = (id: string, nom: string, debut: number | null, fin: number | null): EpoqueFiltre => ({
  id,
  nom,
  debut,
  fin,
})
const EPOQUES = [
  e('prehistory', 'Préhistoire', null, -3300),
  e('early-middle-ages', 'Haut Moyen Âge', 476, 1000),
  e('renaissance', 'Renaissance', 1453, 1600),
  e('digital-era', 'Ère digitale', 2020, null),
]

function afficher(choix: ReadonlySet<string> = new Set(), epoques = EPOQUES) {
  const onChoix = vi.fn<(choix: ReadonlySet<string>) => void>()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FriseDesEpoques epoques={epoques} choix={choix} onChoix={onChoix} />
    </QueryClientProvider>,
  )
  return onChoix
}

test('au repos : toutes les époques, pas de « Tout »', () => {
  afficher()
  expect(screen.getByText('Toutes les époques')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tout' })).not.toBeInTheDocument()
})

test('une plage : son nom, ses bornes dans le calendrier du joueur', () => {
  afficher(new Set(['early-middle-ages', 'renaissance']))
  expect(screen.getByText('Haut Moyen Âge → Renaissance')).toBeInTheDocument()
  expect(
    screen.getByText('de 1229 à 2353 — en années depuis la fondation de Rome'),
  ).toBeInTheDocument()
})

test('déplacer la fin resserre la plage', () => {
  const onChoix = afficher()
  fireEvent.change(screen.getByRole('slider', { name: 'Fin de la plage' }), {
    target: { value: '1' },
  })
  expect([...(onChoix.mock.calls[0]?.[0] ?? [])]).toEqual(['prehistory', 'early-middle-ages'])
})

test('une poignée s’arrête sur l’autre', () => {
  const onChoix = afficher(new Set(['renaissance']))
  fireEvent.change(screen.getByRole('slider', { name: 'Début de la plage' }), {
    target: { value: '3' },
  })
  expect([...(onChoix.mock.calls[0]?.[0] ?? [])]).toEqual(['renaissance'])
})

test('« Tout » remet la frise au repos', async () => {
  const onChoix = afficher(new Set(['renaissance']))
  await userEvent.click(screen.getByRole('button', { name: 'Tout' }))
  expect(onChoix.mock.calls[0]?.[0]?.size).toBe(0)
})

test('sans au moins deux époques datées, rien', () => {
  afficher(new Set(), [])
  expect(screen.queryByRole('region', { name: 'La frise des époques' })).not.toBeInTheDocument()
})

const bornesAffichees = () => ({
  debut: document.querySelector('[data-cote="debut"]')?.textContent ?? null,
  fin: document.querySelector('[data-cote="fin"]')?.textContent ?? null,
})

test('au repos : les noms des deux bouts, aucune année', () => {
  afficher()
  expect(bornesAffichees()).toEqual({ debut: null, fin: null })
  // La piste ne porte pas ces noms (cases) : ils sont dans les bornes, une fois chacun de plus.
  expect(screen.getAllByText('Préhistoire')).toHaveLength(2)
  expect(screen.getAllByText('Ère digitale')).toHaveLength(2)
})

test('une plage : ses deux années, plus les noms des bouts', () => {
  afficher(new Set(['early-middle-ages', 'renaissance']))
  expect(bornesAffichees()).toEqual({ debut: '1229', fin: '2353' })
  expect(screen.getAllByText('Préhistoire')).toHaveLength(1)
  expect(screen.getAllByText('Ère digitale')).toHaveLength(1)
})

test('une seule époque : l’en-tête porte les bornes', () => {
  afficher(new Set(['renaissance']))
  expect(screen.getAllByText('Renaissance')).toHaveLength(2) // la case et le titre
  expect(screen.getByText(/^de 2206 à 2353/)).toBeInTheDocument()
})

test('une plage qui part du premier bout : son année de fin seule, pas le nom du bout', () => {
  afficher(new Set(['prehistory', 'early-middle-ages']))
  expect(bornesAffichees()).toEqual({ debut: null, fin: '1753' })
  expect(screen.getAllByText('Préhistoire')).toHaveLength(1) // la case seule
})
