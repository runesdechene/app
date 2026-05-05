/** Formatage long FR des dates : "5 mai 2026". Wrap centralisé pour éviter
 *  la duplication des `toLocaleDateString('fr-FR', { day, month: 'long', year })`. */
export function formatFrenchLongDate(input: string | Date | null | undefined): string {
  if (input == null) return ''
  const d = typeof input === 'string' ? new Date(input) : input
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
