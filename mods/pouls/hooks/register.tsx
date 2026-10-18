// Le panneau du pouls : un volet qui montre les six chiffres du Hub, par période.
// Les atomes tiennent les valeurs vivantes, que le dessin lit ; $.store garde la période et le repli d'une session à l'autre.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register, SessionRepo } from 'claude-code'

import type { Options, Periode } from '../types'
import {
  chiffresDeLaPeriode,
  dateDeLecture,
  ecartDeTuile,
  formaterNombre,
  MESSAGES_ECHEC,
  PERIODES,
  resume,
  TUILES,
} from './format'
import { lire } from './lecture'

const PANE = 'pouls'
const DEPOT = /github\.com[:/]runesdechene\/app(\.git)?\/?$/i
const DIX_MINUTES = 10 * 60 * 1000

const derniere = atom({ plugin: 'pouls', key: 'derniere' } as const, null)
const echec = atom({ plugin: 'pouls', key: 'echec' } as const, null)
const periodeChoisie = atom({ plugin: 'pouls', key: 'periode' } as const, 'semaine')
const replie = atom({ plugin: 'pouls', key: 'replie' } as const, false)

const COULEUR_ECART = { hausse: 'success', baisse: 'error', egal: 'inactive' } as const

// Le mod n'existe que pour ce dépôt, sur n'importe quelle machine : on compare le dépôt distant, pas un chemin.
function estCeDepot(repo: SessionRepo | null): boolean {
  return DEPOT.test(repo?.remote ?? '')
}

// Une option absente ou d'un autre type n'est pas un secret : elle se lit vide, et la lecture le dit.
function lireOptions(options: PluginOptions): Options {
  const { url, secret } = options
  return { url: typeof url === 'string' ? url : '', secret: typeof secret === 'string' ? secret : '' }
}

// Faute de volet placé (terminal étroit), le panneau se réduit à une ligne de statut.
async function direEnUneLigne($: EngineInterface) {
  const panes = await $.ui.panes()
  if (panes.some(pane => pane.id === PANE && pane.isPlaced)) {
    $.ui.status(undefined) // le volet parle, une ligne de statut ne ferait que redire des chiffres plus vieux
    return
  }
  const periode = await read($, periodeChoisie)
  const chiffres = chiffresDeLaPeriode(await read($, derniere), periode)
  $.ui.status(resume(periode, chiffres, await read($, echec), await $.clock.now()))
}

async function rafraichir($: EngineInterface, options: Options) {
  const periode = await read($, periodeChoisie)
  const lecture = await lire($, options, periode)
  // Si la personne a changé de période pendant la lecture, cette réponse ne répond plus à sa question.
  if ((await read($, periodeChoisie)) !== periode) return

  if (lecture.ok) {
    await update($, derniere, () => lecture)
    await update($, echec, () => null)
  } else {
    await update($, echec, () => lecture.raison)
  }
  await direEnUneLigne($)
  $.ui.invalidate('ui.render') // le « il y a » se recalcule au dessin
}

async function choisirPeriode($: EngineInterface, options: Options, periode: Periode) {
  await update($, periodeChoisie, () => periode)
  await update($, echec, () => null) // un échec d'une autre période ne répond pas à celle-ci
  await $.store.set('periode', periode)
  await rafraichir($, options)
}

async function basculerRepli($: EngineInterface) {
  await $.store.set('replie', await update($, replie, ouvert => !ouvert))
}

export const register: Register = (on, brutes) => {
  const options = lireOptions(brutes)

  on('session.start', async ($, e, next) => {
    if (!estCeDepot(await $.session.repo())) return next(e)

    const stockee = await $.store.get('periode')
    await update($, periodeChoisie, () => PERIODES.find(p => p.valeur === stockee)?.valeur ?? 'semaine')
    const estReplie = (await $.store.get('replie')) === true
    await update($, replie, () => estReplie)

    await $.ui.open({ id: PANE, title: 'Pouls' })
    // La première lecture ne retient pas le démarrage de la session sur le réseau.
    $.clock.after(0, () => void rafraichir($, options))
    $.clock.every(DIX_MINUTES, () => void rafraichir($, options))
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const periode = await read($, periodeChoisie)
    const chiffres = chiffresDeLaPeriode(await read($, derniere), periode)
    const raison = await read($, echec)
    const maintenant = await $.clock.now()
    const estReplie = await read($, replie)

    const boutonRepli = (
      <Button key="repli" plain onPress={() => basculerRepli($)}>
        {estReplie ? '▸ Déplier' : '▾ Replier'}
      </Button>
    )
    if (estReplie) {
      return (
        <Box gap="sm">
          {boutonRepli}
          <Box key="resume">
            <Text wrap="truncate-end">{resume(periode, chiffres, raison, maintenant)}</Text>
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box gap="sm" flexWrap="wrap">
          {PERIODES.map(({ valeur, nom }) => (
            <Button
              key={`periode-${valeur}`}
              variant={valeur === periode ? 'primary' : 'secondary'}
              onPress={() => choisirPeriode($, options, valeur)}
            >
              {nom}
            </Button>
          ))}
        </Box>

        {chiffres === null && raison === null && <Text dimColor>Lecture en cours…</Text>}
        {chiffres !== null &&
          TUILES.map(({ cle, libelle }) => {
            const ecart = ecartDeTuile(cle, chiffres.pouls, chiffres.avant)
            return (
              <Box key={`tuile-${cle}`} gap="sm">
                <Box key={`libelle-${cle}`} width={20}>
                  <Text dimColor>{libelle}</Text>
                </Box>
                <Box key={`valeur-${cle}`} width={8} justifyContent="flex-end">
                  <Text bold>{formaterNombre(chiffres.pouls[cle])}</Text>
                </Box>
                {ecart !== undefined && (
                  <Box key={`ecart-${cle}`}>
                    <Text color={COULEUR_ECART[ecart.sens]}>{ecart.texte}</Text>
                  </Box>
                )}
              </Box>
            )
          })}
        {chiffres !== null && (
          <Box key="age">
            <Text dimColor>Chiffres lus {dateDeLecture(chiffres.lu_a, maintenant)}</Text>
          </Box>
        )}
        {raison !== null && (
          <Box key="echec">
            <Text color="error">{MESSAGES_ECHEC[raison]}</Text>
          </Box>
        )}

        <Box gap="sm">
          <Button key="actualiser" onPress={() => rafraichir($, options)}>
            ↻ Actualiser
          </Button>
          {boutonRepli}
        </Box>
      </Box>
    )
  })
}
