import { describe, expect, test } from 'vitest'
import { validerReponses } from './questionnaire'

describe('validerReponses', () => {
  test('des réponses valables passent, les doublons tombent, les textes vides deviennent null', () => {
    expect(validerReponses({ epoques: ['celtes', 'celtes'], plait: ['carte'], attente: '  ', anniv_jour: 29, anniv_mois: 2 })).toEqual({
      epoques: ['celtes'], decouverte: [], amene: [], plait: ['carte'],
      attente: null, departement: null, anniv_jour: 29, anniv_mois: 2,
    })
  })

  test('trois époques, une réponse inconnue, un 31 février, une attente trop longue : refusés', () => {
    expect(validerReponses({ epoques: ['celtes', 'rome', 'grece'] })).toBeNull()
    expect(validerReponses({ epoques: ['atlantide'] })).toBeNull()
    expect(validerReponses({ anniv_jour: 31, anniv_mois: 2 })).toBeNull()
    expect(validerReponses({ anniv_jour: 12 })).toBeNull()
    expect(validerReponses({ attente: 'x'.repeat(1001) })).toBeNull()
    expect(validerReponses('celtes')).toBeNull()
  })
})
