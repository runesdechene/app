export type CalendarRef = 'gregorian' | 'auc' | 'constantinople'

export const CALENDAR_LABELS: Record<CalendarRef, string> = {
  gregorian: 'Grégorien',
  auc: 'Fondation de Rome (AUC)',
  constantinople: 'Chute de Constantinople',
}

/** Convertit une année Grégorienne vers le référentiel cible */
export function toCalendar(gregorianYear: number, ref: CalendarRef): number {
  switch (ref) {
    case 'auc': return gregorianYear + 753
    case 'constantinople': return gregorianYear - 1453
    default: return gregorianYear
  }
}

/** Convertit une année d'un référentiel vers Grégorien (pour stockage) */
export function toGregorian(year: number, ref: CalendarRef): number {
  switch (ref) {
    case 'auc': return year - 753
    case 'constantinople': return year + 1453
    default: return year
  }
}

/** Formate une année pour affichage (ex: "52 ap. J.-C.", "-500" → "500 av. J.-C.") */
export function formatYear(gregorianYear: number, ref: CalendarRef): string {
  const converted = toCalendar(gregorianYear, ref)

  if (ref === 'auc') {
    return `${converted} AUC`
  }

  if (ref === 'constantinople') {
    if (converted < 0) return `${Math.abs(converted)} av. Chute`
    return `${converted} ap. Chute`
  }

  // Grégorien
  if (gregorianYear < 0) return `${Math.abs(gregorianYear)} av. J.-C.`
  return `${gregorianYear} ap. J.-C.`
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
