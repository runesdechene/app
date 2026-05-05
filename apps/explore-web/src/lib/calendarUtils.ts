export type CalendarRef = 'gregorian' | 'auc' | 'constantinople' | 'imperial' | 'coligny'

export const CALENDAR_LABELS: Record<CalendarRef, string> = {
  gregorian: 'Grégorien',
  auc: 'Fondation de Rome (AUC)',
  constantinople: 'Chute de Constantinople',
  imperial: 'Calendrier impérial',
  coligny: 'Calendrier lunaire gaulois',
}

/** Convertit une année Grégorienne vers le référentiel cible */
export function toCalendar(gregorianYear: number, ref: CalendarRef): number {
  switch (ref) {
    case 'auc': return gregorianYear + 753
    case 'constantinople': return gregorianYear - 1453
    case 'imperial': return gregorianYear - 1804
    case 'coligny': return gregorianYear + 800
    default: return gregorianYear
  }
}

/** Convertit une année d'un référentiel vers Grégorien (pour stockage) */
export function toGregorian(year: number, ref: CalendarRef): number {
  switch (ref) {
    case 'auc': return year - 753
    case 'constantinople': return year + 1453
    case 'imperial': return year + 1804
    case 'coligny': return year - 800
    default: return year
  }
}

/** Formate une année pour affichage (ex: "52 ap. J.-C.", "-500" → "500 av. J.-C.") */
export function formatYear(gregorianYear: number, ref: CalendarRef): string {
  const converted = toCalendar(gregorianYear, ref)

  if (ref === 'auc') {
    if (converted < 0) return `${Math.abs(converted)} av. fondation de Rome`
    return `${converted} ap. fondation de Rome`
  }

  if (ref === 'constantinople') {
    if (converted < 0) return `${Math.abs(converted)} av. chute de Constantinople`
    return `${converted} ap. chute de Constantinople`
  }

  if (ref === 'imperial') {
    if (converted < 0) return `${Math.abs(converted)} av. l'Empire`
    return `An ${converted} du Calendrier impérial`
  }

  if (ref === 'coligny') {
    return `${converted} ère gauloise`
  }

  // Grégorien
  if (gregorianYear < 0) return `${Math.abs(gregorianYear)} av. J.-C.`
  return `${gregorianYear} ap. J.-C.`
}

/* ===========================================
   CALENDRIER RÉPUBLICAIN / IMPÉRIAL
   =========================================== */

const REPUBLICAN_MONTHS = [
  'Vendémiaire', 'Brumaire', 'Frimaire',
  'Nivôse', 'Pluviôse', 'Ventôse',
  'Germinal', 'Floréal', 'Prairial',
  'Messidor', 'Thermidor', 'Fructidor',
]

const SANSCULOTTIDES = [
  'Jour de la Vertu', 'Jour du Génie', 'Jour du Travail',
  'Jour de l\'Opinion', 'Jour des Récompenses', 'Jour de la Révolution',
]

/** Début de l'année républicaine (équinoxe d'automne ~22 sept) pour une année grégorienne */
function republicanNewYear(gregorianYear: number): Date {
  // L'équinoxe tombe le 22 ou 23 sept selon l'année.
  // Simplifié : 22 sept pour les années paires, 23 pour les impaires (assez précis pour 2000-2100)
  const day = gregorianYear % 4 === 0 ? 22 : 22
  return new Date(gregorianYear, 8, day) // mois 8 = septembre
}

/** Convertit une date grégorienne en date républicaine { day, month, monthName, year } */
export function toRepublicanDate(date: Date): { day: number; month: number; monthName: string; year: number } {
  const greg = date.getFullYear()
  const newYear = republicanNewYear(greg)
  const prevNewYear = republicanNewYear(greg - 1)

  // Déterminer si on est avant ou après l'équinoxe de cette année
  let repYear: number
  let dayOfYear: number

  if (date >= newYear) {
    repYear = greg - 1791
    dayOfYear = Math.floor((date.getTime() - newYear.getTime()) / 86400000)
  } else {
    repYear = greg - 1792
    dayOfYear = Math.floor((date.getTime() - prevNewYear.getTime()) / 86400000)
  }

  // 12 mois × 30 jours = 360, puis 5-6 jours complémentaires
  if (dayOfYear < 360) {
    const month = Math.floor(dayOfYear / 30)
    const day = (dayOfYear % 30) + 1
    return { day, month, monthName: REPUBLICAN_MONTHS[month], year: repYear }
  }

  // Sansculottides
  const compDay = dayOfYear - 360
  const name = SANSCULOTTIDES[compDay] ?? SANSCULOTTIDES[0]
  return { day: compDay + 1, month: 12, monthName: name, year: repYear }
}

/* ===========================================
   CALENDRIER DE COLIGNY (GAULOIS)
   Calendrier luni-solaire — mois lunaires (~29.5j)
   Année commence à Samonios (nouvelle lune ~1er novembre)
   Époque : culture de Hallstatt (~800 av. J.-C.)
   =========================================== */

const COLIGNY_MONTH_NAMES = [
  'Samonios', 'Dumannios', 'Riuros',
  'Anagantios', 'Ogronios', 'Cutios',
  'Giamonios', 'Simivisonnios', 'Equos',
  'Elembivios', 'Edrinios', 'Cantlos',
]

const SYNODIC_MONTH = 29.53058867 // durée moyenne d'une lunaison en jours
const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14) // nouvelle lune de référence : 6 jan 2000 18:14 UTC
const COLIGNY_EPOCH = 800

/** Numéro de lunaison pour un timestamp */
function lunationIndex(ts: number): number {
  return Math.floor((ts - REF_NEW_MOON) / (SYNODIC_MONTH * 86400000))
}

/** Timestamp de début d'une lunaison donnée */
function lunationStart(n: number): number {
  return REF_NEW_MOON + n * SYNODIC_MONTH * 86400000
}

/** Nouvelle lune la plus proche du 1er novembre d'une année grégorienne */
function samoniosNewMoon(gregYear: number): number {
  const nov1 = Date.UTC(gregYear, 10, 1)
  const idx = lunationIndex(nov1)
  const before = lunationStart(idx)
  const after = lunationStart(idx + 1)
  return (nov1 - before < after - nov1) ? before : after
}

/** Convertit une date grégorienne en date du calendrier de Coligny */
export function toColignyDate(date: Date): { day: number; monthName: string; year: number } {
  const ts = date.getTime()
  const gregYear = date.getFullYear()

  // Trouver dans quel année gauloise on est (Samonios = ~novembre)
  const currentSam = samoniosNewMoon(gregYear)
  const prevSam = samoniosNewMoon(gregYear - 1)

  let yearStart: number
  let colignyYear: number

  if (ts >= currentSam) {
    yearStart = currentSam
    colignyYear = gregYear + COLIGNY_EPOCH
  } else {
    yearStart = prevSam
    colignyYear = gregYear - 1 + COLIGNY_EPOCH
  }

  // Quelle lunaison dans l'année ?
  const yearLunIdx = lunationIndex(yearStart)
  const curLunIdx = lunationIndex(ts)
  const monthIndex = curLunIdx - yearLunIdx

  // Jour dans la lunaison courante
  const curLunStart = lunationStart(curLunIdx)
  const day = Math.floor((ts - curLunStart) / 86400000) + 1

  // 12 mois normaux + éventuel mois intercalaire (Ciallos)
  const monthName = monthIndex >= 0 && monthIndex < 12
    ? COLIGNY_MONTH_NAMES[monthIndex]
    : 'Ciallos'

  return { day, monthName, year: colignyYear }
}

/** Phase de la lune sous forme d'emoji */
export function getMoonPhase(date: Date): string {
  const ts = date.getTime()
  const daysSinceRef = (ts - REF_NEW_MOON) / 86400000
  const phase = ((daysSinceRef % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH
  const eighth = Math.round(phase / SYNODIC_MONTH * 8) % 8
  return ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'][eighth]
}

/** Formate la fourchette d'une époque pour le dropdown */
export function formatEraRange(yearStart: number | null, yearEnd: number | null): string {
  if (yearStart === null && yearEnd !== null) {
    return `avant ${yearEnd < 0 ? `${Math.abs(yearEnd)} av. J.-C.` : yearEnd}`
  }
  if (yearStart !== null && yearEnd === null) {
    return `${yearStart < 0 ? `${Math.abs(yearStart)} av. J.-C.` : yearStart} à aujourd'hui`
  }
  if (yearStart !== null && yearEnd !== null) {
    const startStr = yearStart < 0 ? `${Math.abs(yearStart)} av. J.-C.` : `${yearStart}`
    const endStr = yearEnd < 0 ? `${Math.abs(yearEnd)} av. J.-C.` : `${yearEnd}`
    return `${startStr} à ${endStr}`
  }
  return ''
}
