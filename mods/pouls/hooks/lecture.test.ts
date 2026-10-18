import { expect, test } from 'claude-code/testing'
import type { HttpInit, HttpResponse } from 'claude-code'

import { lire } from './lecture'

const OPTIONS = { url: 'https://exemple.test/functions/v1/pouls', secret: 'sesame' }

const CORPS = {
  periode: 'semaine',
  pouls: { nouveaux: 12, reactives: 3, actifs: 40, lieux: 7, visites: 21, enigmes: 89 },
  avant: { nouveaux: 10, reactives: 4, lieux: 5, visites: 30, enigmes: 80 },
  lu_a: '2026-10-18T09:30:00.000Z',
}

// Un `$` réduit à ce que `lire` touche : le réseau, simulé, qui garde la trace de ses appels.
function reseau(repondre: () => Promise<HttpResponse>) {
  const appels: { url: string; init?: HttpInit }[] = []
  const $ = {
    http: {
      fetch: (url: string, init?: HttpInit) => {
        appels.push({ url, init })
        return repondre()
      },
    },
  }
  return { $, appels }
}

const reponse = (status: number, texte: string): HttpResponse => ({
  status,
  ok: status >= 200 && status < 300,
  headers: {},
  text: texte,
})

test('sans secret configuré, la lecture le dit sans appeler le réseau', async () => {
  const { $, appels } = reseau(async () => reponse(200, JSON.stringify(CORPS)))

  const lecture = await lire($, { ...OPTIONS, secret: '' }, 'semaine')

  expect(lecture).toEqual({ ok: false, raison: 'secret_absent' })
  expect(appels).toHaveLength(0)
})

test('un 401 devient un refus, pas une erreur réseau', async () => {
  const { $ } = reseau(async () => reponse(401, JSON.stringify({ erreur: 'secret' })))

  expect(await lire($, OPTIONS, 'semaine')).toEqual({ ok: false, raison: 'refus' })
})

test('une réponse valide rend les six chiffres et la date de lecture', async () => {
  const { $, appels } = reseau(async () => reponse(200, JSON.stringify(CORPS)))

  const lecture = await lire($, OPTIONS, 'semaine')

  expect(lecture.ok).toBe(true)
  if (!lecture.ok) return
  expect(lecture.pouls.enigmes).toBe(89)
  expect(lecture.avant?.visites).toBe(30)
  expect(lecture.lu_a).toBe(Date.parse('2026-10-18T09:30:00.000Z'))
  expect(appels).toEqual([
    {
      url: OPTIONS.url,
      init: {
        method: 'POST',
        headers: { 'X-Pouls-Secret': 'sesame', 'Content-Type': 'application/json' },
        body: JSON.stringify({ periode: 'semaine' }),
      },
    },
  ])
})

test('en « toujours », avant vaut null', async () => {
  const { $ } = reseau(async () =>
    reponse(200, JSON.stringify({ ...CORPS, periode: 'toujours', avant: null })),
  )

  const lecture = await lire($, OPTIONS, 'toujours')

  expect(lecture.ok && lecture.avant).toBe(null)
})

test('une exception du réseau devient une erreur réseau, sans rien lancer', async () => {
  const { $ } = reseau(async () => {
    throw new Error('hors ligne')
  })

  expect(await lire($, OPTIONS, 'semaine')).toEqual({ ok: false, raison: 'reseau' })
})

test('un corps illisible ou incomplet devient une erreur réseau', async () => {
  for (const texte of ['pas du json', '{}', JSON.stringify({ ...CORPS, pouls: { nouveaux: 1 } })]) {
    const { $ } = reseau(async () => reponse(200, texte))
    expect(await lire($, OPTIONS, 'semaine')).toEqual({ ok: false, raison: 'reseau' })
  }
})
