/**
 * Formate une date de RDV d'expédition en label relatif.
 * "Aujourd'hui · 09:00" / "Demain · 14:00" / "Dans 4 jours · 10:30" /
 * "Le 22 juin · 19:00" pour > 7j ou passé > 7j → date longue.
 */
export function formatRelativeRdv(rdvAt: string): string {
  const rdv = new Date(rdvAt)
  const rdvMs = rdv.getTime()
  const now = Date.now()
  const diffMs = rdvMs - now

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const dayDiff = Math.floor(
    (rdv.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  )

  const time = rdv.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  if (dayDiff === 0) return `Aujourd'hui · ${time}`
  if (dayDiff === 1) return `Demain · ${time}`
  if (dayDiff > 1 && dayDiff < 7) return `Dans ${dayDiff} jours · ${time}`

  if (diffMs < 0) {
    const ago = Math.abs(dayDiff)
    if (ago === 1) return 'Hier'
    if (ago < 7) return `Il y a ${ago} jours`
  }

  return rdv.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long',
    year: rdv.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }) + ` · ${time}`
}
