// Formatte une date ISO en « il y a X » (fr). Standalone, pas React-aware.
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const day = 86_400_000
  const days = Math.floor(diff / day)
  if (days < 1) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 30) return `il y a ${days} j`
  const months = Math.floor(days / 30)
  if (months < 12) return `il y a ${months} mois`
  const years = Math.floor(days / 365)
  return `il y a ${years} an${years > 1 ? 's' : ''}`
}
