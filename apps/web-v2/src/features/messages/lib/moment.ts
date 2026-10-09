/**
 * QUOI     — le moment d'un murmure, dit doucement : « ce matin », « hier soir », « lundi »,
 *            « le 12 septembre » ; et quand le poser entre deux murmures.
 * POURQUOI — maquette 264:162 : pas d'heure sous chaque message ; le temps ne s'écrit que
 *            lorsqu'il a passé (une heure de silence au moins).
 */
const JOUR_SEMAINE = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' })
const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })
const HEURE = 60 * 60 * 1000

function partie(d: Date): 'matin' | 'après-midi' | 'soir' {
  const h = d.getHours()
  if (h < 12) return 'matin'
  if (h < 18) return 'après-midi'
  return 'soir'
}

function jour(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function moment(quand: string, maintenant = new Date()): string {
  const d = new Date(quand)
  const ecartJours = Math.round((jour(maintenant) - jour(d)) / (24 * HEURE))
  const p = partie(d)
  if (ecartJours === 0)
    return p === 'soir' ? 'ce soir' : p === 'matin' ? 'ce matin' : 'cet après-midi'
  if (ecartJours === 1) return `hier ${p}`
  if (ecartJours < 7) return JOUR_SEMAINE.format(d)
  return `le ${DATE.format(d)}`
}

// Un moment se pose avant le premier murmure, et après une heure de silence.
export function apresUnSilence(precedent: string | undefined, quand: string): boolean {
  if (!precedent) return true
  return new Date(quand).getTime() - new Date(precedent).getTime() >= HEURE
}
