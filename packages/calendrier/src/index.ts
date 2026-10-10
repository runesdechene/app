/**
 * QUOI     — les quatre calendriers d'Explore, et la conversion des dates écrites en chrétien.
 * POURQUOI — spec 2026-10-09-choix-du-calendrier : une date se balise entre accolades dans un
 *            texte (`{52 av. J.-C.}`, `{IIIe siècle av. J.-C.}`) ; l'appli et le Hub la réécrivent
 *            dans le calendrier choisi. Un seul code pour les deux : l'aperçu du Hub calcule comme
 *            l'appli.
 * ATTENTION — une année est chrétienne : négatif = avant J.-C., sans an zéro (−52 = 52 av. J.-C.),
 *            comme `places.year_exact`. En chrétien, une balise s'affiche mot pour mot.
 */
export type Calendrier = 'chretien' | 'moderne' | 'rome' | 'constantinople'

export const CALENDRIERS: readonly { id: Calendrier; libelle: string; explication: string }[] = [
  {
    id: 'chretien',
    libelle: 'Chrétien — av. / ap. J.-C.',
    explication:
      'Compté depuis la naissance de Jésus selon Denys le Petit (VIᵉ siècle), qui s’est trompé de quelques années : les historiens la placent entre 7 et 4 av. J.-C.',
  },
  {
    id: 'moderne',
    libelle: 'Moderne — av. è. c. / è. c.',
    explication: 'Les mêmes années, sans référence religieuse : avant l’ère commune, ère commune.',
  },
  {
    id: 'rome',
    libelle: 'Fondation de Rome',
    explication: 'Compté depuis la fondation légendaire de Rome, en 753 av. J.-C.',
  },
  {
    id: 'constantinople',
    libelle: 'Chute de Constantinople',
    explication: 'Compté depuis la prise de Constantinople par les Ottomans, en 1453.',
  },
]

export function estCalendrier(v: unknown): v is Calendrier {
  return CALENDRIERS.some((c) => c.id === v)
}

type Sens = 'av' | 'ap'

// Une année comptée dans un calendrier : « 702 » « ap. ». `null` : l'année même de la chute de
// Constantinople, qui n'est ni avant ni après.
function compter(annee: number, calendrier: Calendrier): { n: number; sens: Sens } | null {
  if (calendrier === 'chretien' || calendrier === 'moderne') {
    return annee < 0 ? { n: -annee, sens: 'av' } : { n: annee, sens: 'ap' }
  }
  // L'année astronomique a un an zéro : 1 av. J.-C. = 0, 52 av. J.-C. = −51.
  const astronomique = annee < 0 ? annee + 1 : annee
  if (calendrier === 'rome') {
    const depuisRome = astronomique + 753
    return depuisRome >= 1 ? { n: depuisRome, sens: 'ap' } : { n: 1 - depuisRome, sens: 'av' }
  }
  const depuisLaChute = astronomique - 1453
  if (depuisLaChute === 0) return null
  return depuisLaChute > 0
    ? { n: depuisLaChute, sens: 'ap' }
    : { n: -depuisLaChute, sens: 'av' }
}

// `explicite` : la balise disait « ap. J.-C. ». Sans lui, une année de notre ère reste nue en
// chrétien et en moderne (« 930 »), comme dans les textes.
function suffixe(sens: Sens, calendrier: Calendrier, explicite: boolean): string {
  switch (calendrier) {
    case 'chretien':
      return sens === 'av' ? ' av. J.-C.' : explicite ? ' ap. J.-C.' : ''
    case 'moderne':
      return sens === 'av' ? ' av. è. c.' : explicite ? ' è. c.' : ''
    case 'rome':
      return ` ${sens}. la fondation de Rome`
    case 'constantinople':
      return ` ${sens}. la chute de Constantinople`
  }
}

function romain(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let reste = n
  return table.reduce((acc, [valeur, lettres]) => {
    const fois = Math.floor(reste / valeur)
    reste -= fois * valeur
    return acc + lettres.repeat(fois)
  }, '')
}

const VALEURS: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 }

function deRomain(chiffres: string): number {
  const valeurs = [...chiffres].map((c) => VALEURS[c] ?? 0)
  return valeurs.reduce((total, v, i) => total + (v < (valeurs[i + 1] ?? 0) ? -v : v), 0)
}

function annee(a: number, calendrier: Calendrier, explicite: boolean): string {
  const compte = compter(a, calendrier)
  if (!compte) return 'l’année de la chute de Constantinople'
  return `${String(compte.n)}${suffixe(compte.sens, calendrier, explicite)}`
}

// Le siècle se prend sur l'année déjà convertie : −52 est au VIIIᵉ siècle de Rome.
function siecle(a: number, calendrier: Calendrier, explicite: boolean): string {
  const compte = compter(a, calendrier) ?? { n: 1, sens: 'ap' }
  const rang = Math.ceil(compte.n / 100)
  return `${romain(rang)}${rang === 1 ? 'ᵉʳ' : 'ᵉ'} siècle${suffixe(compte.sens, calendrier, explicite)}`
}

export function anneeEnClair(a: number, calendrier: Calendrier): string {
  return annee(a, calendrier, false)
}

export function siecleEnClair(a: number, calendrier: Calendrier): string {
  return siecle(a, calendrier, false)
}

const BALISE = /\{([^{}]*)\}/g
const ANNEE = /^([1-9]\d{0,3})(?: (av|ap)\. J\.-C\.)?$/
const SIECLE = /^([IVXLC]+)(?:e|er|ᵉ|ᵉʳ) siècle(?: (av|ap)\. J\.-C\.)?$/

// Le contenu d'une balise, converti ; `null` s'il sort de la grammaire de la spec.
function dateEnClair(contenu: string, calendrier: Calendrier): string | null {
  const enAnnee = ANNEE.exec(contenu)
  const enSiecle = SIECLE.exec(contenu)
  if (!enAnnee && !enSiecle) return null
  if (calendrier === 'chretien') return contenu
  if (enAnnee) {
    const n = Number(enAnnee[1])
    return annee(enAnnee[2] === 'av' ? -n : n, calendrier, enAnnee[2] === 'ap')
  }
  if (!enSiecle) return null
  // Un siècle passe par son milieu : le IIIe av. J.-C. (−300 à −201) par −250.
  const milieu = 100 * deRomain(enSiecle[1] ?? '') - 50
  return siecle(enSiecle[2] === 'av' ? -milieu : milieu, calendrier, enSiecle[2] === 'ap')
}

export function texteEnClair(texte: string, calendrier: Calendrier): string {
  return texte.replace(BALISE, (_balise, contenu: string) => {
    const propre = contenu.trim()
    return dateEnClair(propre, calendrier) ?? propre
  })
}

export function balisesIncomprises(texte: string): string[] {
  const incomprises = [...texte.matchAll(BALISE)]
    .map((m) => (m[1] ?? '').trim())
    .filter((contenu) => dateEnClair(contenu, 'moderne') === null)
  const horsBalises = texte.replace(BALISE, '')
  return /[{}]/.test(horsBalises) ? [...incomprises, 'une accolade seule'] : incomprises
}
