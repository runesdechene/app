/**
 * QUOI     — les notifications se rangent en « Aujourd’hui », « Cette semaine », « Plus tôt ».
 */
import { expect, test } from 'vitest'
import type { Notification } from '../api/lireNotifications'
import { parMoment } from './moments'

const n = (id: number, quand: Date): Notification => ({
  id,
  type: 'new_photo',
  quand: quand.toISOString(),
  lu: true,
  qui: null,
  lieu: null,
  nombre: null,
  extrait: null,
  evenement: null,
})

test('trois rubriques, dans l’ordre, sans rubrique vide', () => {
  const maintenant = new Date(2026, 8, 30, 10, 0)
  const rubriques = parMoment(
    [
      n(1, new Date(2026, 8, 30, 8, 0)),
      n(4, new Date(2026, 8, 30, 0, 5)),
      n(2, new Date(2026, 8, 27, 20, 0)),
      n(3, new Date(2026, 8, 12, 9, 0)),
    ],
    maintenant,
  )
  expect(rubriques.map((r) => [r.titre, r.liste.map((x) => x.id)])).toEqual([
    ['Aujourd’hui', [1, 4]],
    ['Cette semaine', [2]],
    ['Plus tôt', [3]],
  ])
  expect(parMoment([n(5, new Date(2026, 8, 1))], maintenant).map((r) => r.titre)).toEqual([
    'Plus tôt',
  ])
})
