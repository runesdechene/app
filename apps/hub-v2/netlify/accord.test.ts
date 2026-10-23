/**
 * QUOI     — la règle de l'accord aux nouvelles entre le Hub et Shopify : la dernière action gagne.
 */
import { describe, expect, test } from 'vitest'
import { appliquerAccord, choixDeShopify } from './functions/lib/accord'

const HIER = '2026-10-22T10:00:00Z'
const AUJOURDHUI = '2026-10-23T10:00:00Z'

describe('appliquerAccord', () => {
  test('un accord plus récent l’emporte', () => {
    expect(appliquerAccord({ accord: false, le: HIER }, { accord: true, le: AUJOURDHUI, porte: 'shopify' })).toEqual({
      accord: true,
      le: AUJOURDHUI,
      porte: 'shopify',
    })
  })

  test('un choix plus ancien ne change rien', () => {
    expect(appliquerAccord({ accord: false, le: AUJOURDHUI }, { accord: true, le: HIER, porte: 'shopify' })).toBeNull()
  })

  test('un désabonnement récent l’emporte sur un vieil abonnement Shopify', () => {
    const apres = appliquerAccord({ accord: true, le: HIER }, { accord: false, le: AUJOURDHUI, porte: 'desabonnement' })
    expect(apres).toEqual({ accord: false, le: AUJOURDHUI, porte: 'desabonnement' })
    expect(appliquerAccord({ accord: false, le: AUJOURDHUI }, { accord: true, le: HIER, porte: 'shopify' })).toBeNull()
  })

  test('une fiche jamais réglée prend le premier choix daté', () => {
    expect(appliquerAccord({ accord: false, le: null }, { accord: true, le: HIER, porte: 'site' })).toEqual({
      accord: true,
      le: HIER,
      porte: 'site',
    })
  })

  test('un choix sans date, ou identique, ne réécrit rien', () => {
    expect(appliquerAccord({ accord: false, le: null }, { accord: false, le: null, porte: 'shopify' })).toBeNull()
    expect(appliquerAccord({ accord: true, le: HIER }, { accord: true, le: AUJOURDHUI, porte: 'shopify' })).toBeNull()
  })
})

describe('le refus venu de Shopify', () => {
  test('un désabonnement Shopify se date, même si la fiche disait déjà non sans date', () => {
    expect(appliquerAccord({ accord: false, le: null }, { accord: false, le: HIER, porte: 'shopify' })).toEqual({
      accord: false,
      le: HIER,
      porte: 'shopify',
    })
  })

  test('subscribed accepte, unsubscribed refuse avec sa date, jamais abonné ne dit rien', () => {
    expect(choixDeShopify({ state: 'subscribed', consent_updated_at: HIER }, AUJOURDHUI)).toEqual({ accord: true, le: HIER })
    expect(choixDeShopify({ state: 'unsubscribed', consent_updated_at: null }, AUJOURDHUI)).toEqual({ accord: false, le: AUJOURDHUI })
    expect(choixDeShopify({ state: 'not_subscribed', consent_updated_at: HIER }, AUJOURDHUI)).toEqual({ accord: false, le: null })
    expect(choixDeShopify(null, AUJOURDHUI)).toEqual({ accord: false, le: null })
  })
})
