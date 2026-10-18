import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { HttpResponse, On } from 'claude-code'

const OPTIONS = { url: 'https://exemple.test/functions/v1/pouls', secret: 'sesame' }

// Ce que l'Edge Function rend pour « semaine » : cinq écarts possibles, actifs n'en a pas.
const SEMAINE = {
  periode: 'semaine',
  pouls: { nouveaux: 12, reactives: 3, actifs: 40, lieux: 7, visites: 21, enigmes: 89 },
  avant: { nouveaux: 10, reactives: 4, lieux: 5, visites: 30, enigmes: 80 },
  lu_a: '2026-10-18T09:30:00.000Z',
}
const MOIS = { ...SEMAINE, periode: 'mois', pouls: { ...SEMAINE.pouls, nouveaux: 51 } }
const TOUJOURS = { ...SEMAINE, periode: 'toujours', avant: null }

const LU_A = Date.parse(SEMAINE.lu_a)
const MINUTE = 60 * 1000
const DEPOT = { root: 'C:/depot', remote: 'https://github.com/runesdechene/app.git', internal: false, name: null }
// Le mod suit le dépôt distant, pas un chemin : https, ssh et une session de worktree en sont.
const DEPOTS_DU_MOD = {
  'https': DEPOT,
  'ssh': { ...DEPOT, remote: 'git@github.com:runesdechene/app.git' },
  'worktree': { ...DEPOT, root: 'C:/depot/.claude/worktrees/mod-pouls' },
}
const AUTRES_DEPOTS = {
  'https': { ...DEPOT, remote: 'https://github.com/autre/projet.git' },
  'ssh': { ...DEPOT, remote: 'git@github.com:autre/projet.git' },
  'même propriétaire, autre nom': { ...DEPOT, remote: 'https://github.com/runesdechene/app-autre.git' },
}
const PANE = {
  title: 'Pouls',
  isFocused: false,
  bodyColumns: 80,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
} as const

const reponse = (status: number, corps: unknown): HttpResponse => ({
  status,
  ok: status >= 200 && status < 300,
  headers: {},
  text: JSON.stringify(corps),
})

type Banc = {
  repondre: (periode: string) => HttpResponse
  periodes: string[] // la période demandée à chaque appel réseau
  stockage: Map<string, unknown> // $.store, que les tests relisent ; le kit ne le rend pas
  statuts: (string | undefined)[]
  ouvertures: number
  estPlace: boolean
  ferme: boolean // le volet a quitté $.ui.panes(), fermé à la main
}

// Le monde sous le mod : le dépôt, le réseau, l'horloge, le stockage, l'ouverture du volet.
function poser(on: On, depot: typeof DEPOT, stocke: Record<string, unknown> = {}) {
  const banc: Banc = {
    repondre: () => reponse(200, SEMAINE),
    periodes: [],
    stockage: new Map(Object.entries(stocke)),
    statuts: [],
    ouvertures: 0,
    estPlace: true,
    ferme: false,
  }
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.repo', () => ({ value: depot }))
  on('http.fetch', (_$, e) => {
    const corps: { periode: string } = JSON.parse(String(e.init?.body))
    banc.periodes.push(corps.periode)
    return { value: banc.repondre(corps.periode) }
  })
  on('ui.open', () => {
    banc.ouvertures += 1
    return { value: banc.estPlace ? { isPlaced: true } : { isPlaced: false, reason: 'trop étroit' } }
  })
  on('ui.panes', () => ({
    value: banc.ferme ? [] : [{ id: 'pouls', title: 'Pouls', isShown: true, isFocused: false, isPlaced: banc.estPlace }],
  }))
  on('ui.status', (_$, e) => {
    banc.statuts.push(e.text)
    return { value: undefined }
  })
  on('store.get', (_$, e) => ({ value: banc.stockage.get(e.key) }))
  on('store.set', (_$, e) => {
    banc.stockage.set(e.key, e.value)
    return { value: undefined }
  })
  const horloge = mock.clock(on, { now: LU_A + 2 * MINUTE })
  return { banc, horloge }
}

async function demarrer($: Engine) {
  await $.session.start({ cwd: 'C:/depot', surface: 'terminal', isInteractive: true })
}

const SURFACES = ['terminal', 'desktop'] as const

for (const surface of SURFACES) {
  const monter = ($: Engine) => $.ui.mount({ plugin: 'pouls', surface, component: 'Pane', requestId: 'pouls', props: PANE })

  describe(surface, () => {
    test('les six tuiles sont là, dans l’ordre du Hub', { options: OPTIONS }, async ($, on) => {
      const { horloge } = poser(on, DEPOT)
      await demarrer($)
      await horloge.settle()
      const ui = await monter($)

      const libelles = (await ui.findAll({ type: 'Box' })).filter(b => b.key?.startsWith('libelle-')).map(b => b.text)
      expect(libelles).toEqual([
        'Nouveaux comptes',
        'Comptes réactivés',
        'Actifs',
        'Lieux ajoutés',
        'Visites sur place',
        'Énigmes percées',
      ])
      expect((await ui.find({ key: 'valeur-nouveaux' }))?.text).toBe('12')
      expect((await ui.find({ key: 'valeur-enigmes' }))?.text).toBe('89')
    })

    test('chaque tuile écrit son écart comme le Hub', { options: OPTIONS }, async ($, on) => {
      const { horloge } = poser(on, DEPOT)
      await demarrer($)
      await horloge.settle()
      const ui = await monter($)

      const ecart = async (cle: string) => (await ui.find({ key: `ecart-${cle}` }))?.text
      expect(await ecart('nouveaux')).toBe('+2') // sous 20, l'écart est une valeur
      expect(await ecart('reactives')).toBe('−1')
      expect(await ecart('visites')).toBe('−30 %') // dès 20, un pourcentage
      expect(await ecart('enigmes')).toBe('+11 %')
    })

    test('Actifs n’affiche jamais d’écart', { options: OPTIONS }, async ($, on) => {
      const { horloge } = poser(on, DEPOT)
      await demarrer($)
      await horloge.settle()
      const ui = await monter($)

      expect(await ui.find({ key: 'valeur-actifs' })).toBeDefined()
      expect(await ui.find({ key: 'ecart-actifs' })).toBeUndefined()
      expect(await ui.find({ key: 'ecart-nouveaux' })).toBeDefined() // le test ne passe pas à vide
    })

    test('en « toujours », aucune tuile n’affiche d’écart', { options: OPTIONS }, async ($, on) => {
      const { banc, horloge } = poser(on, DEPOT, { periode: 'toujours' })
      banc.repondre = () => reponse(200, TOUJOURS)
      await demarrer($)
      await horloge.settle()
      const ui = await monter($)

      const ecarts = (await ui.findAll({ type: 'Box' })).filter(b => b.key?.startsWith('ecart-'))
      expect(banc.periodes).toEqual(['toujours'])
      expect(await ui.find({ key: 'valeur-nouveaux' })).toBeDefined()
      expect(ecarts).toHaveLength(0)
    })

    test('après un échec, les chiffres précédents restent et sont datés', { options: OPTIONS }, async ($, on) => {
      const { banc, horloge } = poser(on, DEPOT)
      await demarrer($)
      await horloge.settle()
      const ui = await monter($)
      expect((await ui.find({ key: 'age' }))?.text).toMatch(/il y a 2 min/)

      banc.repondre = () => reponse(503, { erreur: 'base' })
      await horloge.advance(10 * MINUTE) // la relecture des dix minutes échoue

      expect((await ui.find({ key: 'valeur-nouveaux' }))?.text).toBe('12') // pas un zéro
      expect((await ui.find({ key: 'valeur-enigmes' }))?.text).toBe('89')
      expect((await ui.find({ key: 'age' }))?.text).toMatch(/il y a 12 min/)
      expect(await ui.find({ key: 'echec' })).toBeDefined()
    })

    test('sans secret, le panneau explique quoi faire', { options: { ...OPTIONS, secret: '' } }, async ($, on) => {
      const { banc, horloge } = poser(on, DEPOT)
      await demarrer($)
      await horloge.settle()
      const ui = await monter($)

      expect(banc.periodes).toHaveLength(0) // pas de secret, pas de réseau
      expect((await ui.find({ key: 'echec' }))?.text).toContain('Secret du pouls')
      expect(await ui.find({ key: 'valeur-nouveaux' })).toBeUndefined() // aucun chiffre inventé
    })

    test('un secret refusé et une lecture échouée ne se lisent pas pareil', { options: OPTIONS }, async ($, on) => {
      const { banc, horloge } = poser(on, DEPOT)
      banc.repondre = () => reponse(401, { erreur: 'secret' })
      await demarrer($)
      await horloge.settle()
      const ui = await monter($)
      const refus = (await ui.find({ key: 'echec' }))?.text

      banc.repondre = () => reponse(503, { erreur: 'base' })
      await horloge.advance(10 * MINUTE)
      const reseau = (await ui.find({ key: 'echec' }))?.text

      expect(refus).toContain('refusé')
      expect(reseau).toContain('échoué')
      expect(refus).not.toBe(reseau)
    })

    test('le clic sur une période relit', { options: OPTIONS }, async ($, on) => {
      const { banc, horloge } = poser(on, DEPOT)
      await demarrer($)
      await horloge.settle()
      const ui = await monter($)
      banc.repondre = periode => reponse(200, periode === 'mois' ? MOIS : SEMAINE)

      await ui.press({ key: 'periode-mois' })

      expect(banc.periodes).toEqual(['semaine', 'mois'])
      expect((await ui.find({ key: 'valeur-nouveaux' }))?.text).toBe('51')
      expect(banc.stockage.get('periode')).toBe('mois') // le choix survit à la session
    })

    test('une période dont la lecture échoue ne montre pas les chiffres d’une autre', { options: OPTIONS }, async ($, on) => {
      const { banc, horloge } = poser(on, DEPOT)
      await demarrer($)
      await horloge.settle()
      const ui = await monter($)
      banc.repondre = () => reponse(503, { erreur: 'base' })

      await ui.press({ key: 'periode-mois' })

      expect(await ui.find({ key: 'valeur-nouveaux' })).toBeUndefined()
      expect(await ui.find({ key: 'echec' })).toBeDefined()
    })

    test('le clic sur actualiser relit', { options: OPTIONS }, async ($, on) => {
      const { banc, horloge } = poser(on, DEPOT)
      await demarrer($)
      await horloge.settle()
      const ui = await monter($)

      await ui.press({ key: 'actualiser' })

      expect(banc.periodes).toEqual(['semaine', 'semaine'])
    })

    test('le clic sur le repli ne laisse qu’une ligne', { options: OPTIONS }, async ($, on) => {
      const { banc, horloge } = poser(on, DEPOT)
      await demarrer($)
      await horloge.settle()
      const ui = await monter($)

      await ui.press({ key: 'repli' })

      expect(await ui.find({ key: 'valeur-nouveaux' })).toBeUndefined()
      expect(await ui.find({ key: 'periode-mois' })).toBeUndefined()
      expect((await ui.find({ key: 'resume' }))?.text).toContain('12')
      expect(banc.stockage.get('replie')).toBe(true) // le repli survit à la session

      await ui.press({ key: 'repli' })
      expect(await ui.find({ key: 'valeur-nouveaux' })).toBeDefined()
    })

    test('le dernier repli et la dernière période reviennent à la session suivante', { options: OPTIONS }, async ($, on) => {
      const { banc, horloge } = poser(on, DEPOT, { periode: 'mois', replie: true })
      banc.repondre = () => reponse(200, MOIS)
      await demarrer($)
      await horloge.settle()
      const ui = await monter($)

      expect(banc.periodes).toEqual(['mois'])
      expect(await ui.find({ key: 'valeur-nouveaux' })).toBeUndefined()
      expect((await ui.find({ key: 'resume' }))?.text).toContain('51')
    })

    for (const [forme, depot] of Object.entries(DEPOTS_DU_MOD)) {
      test(`dans ce dépôt (${forme}), le mod s’ouvre et lit`, { options: OPTIONS }, async ($, on) => {
        const { banc, horloge } = poser(on, depot)
        await demarrer($)
        await horloge.settle()

        expect(banc.ouvertures).toBe(1)
        expect(banc.periodes).toEqual(['semaine'])
      })
    }

    for (const [forme, depot] of Object.entries(AUTRES_DEPOTS)) {
      test(`hors de ce dépôt (${forme}), le mod ne fait rien`, { options: OPTIONS }, async ($, on) => {
        const { banc, horloge } = poser(on, depot)
        await demarrer($)
        await horloge.advance(30 * MINUTE)

        expect(banc.ouvertures).toBe(0)
        expect(banc.periodes).toHaveLength(0)
      })
    }

    test('un volet que personne n’a placé se réduit à une ligne de statut', { options: OPTIONS }, async ($, on) => {
      const { banc, horloge } = poser(on, DEPOT)
      banc.estPlace = false
      await demarrer($)
      await horloge.settle()

      const ligne = banc.statuts.at(-1)
      expect(ligne).toContain('12')
      expect(ligne).toContain('89')
    })

    test('un volet fermé à la main ne revient pas en ligne de statut', { options: OPTIONS }, async ($, on) => {
      const { banc, horloge } = poser(on, DEPOT)
      await demarrer($)
      await horloge.settle()
      banc.ferme = true // le volet quitte $.ui.panes(), comme après un clic sur la croix

      await horloge.advance(10 * MINUTE) // la relecture des dix minutes passe

      expect(banc.periodes).toEqual(['semaine', 'semaine']) // le test ne passe pas à vide
      expect(banc.statuts.every(ligne => ligne === undefined)).toBe(true)
    })
  })
}
