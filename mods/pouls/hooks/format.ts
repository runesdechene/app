// Ce que le panneau écrit : libellés, écarts, dates, messages d'échec.
// Le texte seul, sans état ni dessin ; register.tsx le branche.

import type { Avant, Periode, Pouls, Raison, Reussie } from '../types'

export const PERIODES: { valeur: Periode; nom: string }[] = [
  { valeur: 'jour', nom: "Aujourd'hui" },
  { valeur: 'semaine', nom: 'Cette semaine' },
  { valeur: 'mois', nom: 'Ce mois-ci' },
  { valeur: 'toujours', nom: 'Depuis toujours' },
]

// Les six tuiles, dans l'ordre du Hub (apps/hub-v2/.../accueil/components/Pouls.tsx).
export const TUILES: { cle: keyof Pouls; libelle: string }[] = [
  { cle: 'nouveaux', libelle: 'Nouveaux comptes' },
  { cle: 'reactives', libelle: 'Comptes réactivés' },
  { cle: 'actifs', libelle: 'Actifs' },
  { cle: 'lieux', libelle: 'Lieux ajoutés' },
  { cle: 'visites', libelle: 'Visites sur place' },
  { cle: 'enigmes', libelle: 'Énigmes percées' },
]

export const MESSAGES_ECHEC: Record<Raison, string> = {
  secret_absent: "Secret absent : l'option « Secret du pouls » du mod pouls est à renseigner.",
  refus: "Secret refusé : l'option « Secret du pouls » n'est pas la valeur de pouls_secret.",
  reseau: 'Lecture échouée : le réseau, la base ou la réponse a fait défaut.',
}

const nombre = new Intl.NumberFormat('fr-FR')
const heure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const relatif = new Intl.RelativeTimeFormat('fr', { numeric: 'always' })

export type Ecart = { texte: string; sens: 'hausse' | 'baisse' | 'egal' }

const SEUIL_POURCENTAGE = 20

// La règle de apps/hub-v2/src/shared/lib/ecart.ts, redite ici : le mod ne partage pas de code avec l'appli.
// Sous 20, un pourcentage ment (de 2 à 3, « +50 % ») : on écrit l'écart en valeur.
function ecart(actuel: number, avant: number): Ecart {
  if (actuel === avant) return { texte: '=', sens: 'egal' }
  if (avant === 0) return { texte: 'nouveau', sens: 'hausse' }
  const sens = actuel > avant ? 'hausse' : 'baisse'
  const signe = sens === 'hausse' ? '+' : '−'
  if (avant < SEUIL_POURCENTAGE) return { texte: `${signe}${String(Math.abs(actuel - avant))}`, sens }
  const pourcentage = Math.round((Math.abs(actuel - avant) / avant) * 100)
  if (pourcentage === 0) return { texte: '=', sens: 'egal' }
  return { texte: `${signe}${String(pourcentage)} %`, sens }
}

// Jamais sur « actifs » (last_login_at ne garde que la dernière connexion), jamais sans période d'avant.
export function ecartDeTuile(cle: keyof Pouls, pouls: Pouls, avant: Avant | null): Ecart | undefined {
  if (cle === 'actifs' || avant === null) return undefined
  return ecart(pouls[cle], avant[cle])
}

export const formaterNombre = (n: number) => nombre.format(n)

function ecoule(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return relatif.format(-minutes, 'minute')
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return relatif.format(-heures, 'hour')
  return relatif.format(-Math.floor(heures / 24), 'day')
}

// « il y a 12 minutes (11:30) » : l'heure reste vraie entre deux redessins, le « il y a » seulement au dernier.
export function dateDeLecture(luA: number, maintenant: number): string {
  return `${ecoule(maintenant - luA)} (${heure.format(luA)})`
}

// Les chiffres d'une autre période ne répondent pas à la question posée : on ne les montre pas.
export function chiffresDeLaPeriode(derniere: Reussie | null, periode: Periode): Reussie | null {
  return derniere?.periode === periode ? derniere : null
}

// Une ligne : le panneau replié et, faute de volet placé, la ligne de statut.
export function resume(periode: Periode, chiffres: Reussie | null, echec: Raison | null, maintenant: number): string {
  const nom = PERIODES.find(p => p.valeur === periode)?.nom ?? periode
  if (chiffres === null) return `Pouls · ${nom} · ${echec === null ? 'lecture en cours…' : MESSAGES_ECHEC[echec]}`
  const { nouveaux, reactives, actifs, lieux, visites, enigmes } = chiffres.pouls
  const lignes = [
    `${formaterNombre(nouveaux)} nouveaux`,
    `${formaterNombre(reactives)} réactivés`,
    `${formaterNombre(actifs)} actifs`,
    `${formaterNombre(lieux)} lieux`,
    `${formaterNombre(visites)} visites`,
    `${formaterNombre(enigmes)} énigmes`,
  ]
  const lu = `lu ${dateDeLecture(chiffres.lu_a, maintenant)}`
  const suite = echec === null ? lu : `${lu}, relecture échouée`
  return `Pouls · ${nom} · ${lignes.join(' · ')} · ${suite}`
}
