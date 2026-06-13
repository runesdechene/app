/** Met une majuscule à la première lettre (le reste inchangé). '' → ''. */
export function capitalizeFirst(s: string | null | undefined): string {
  const v = (s ?? '').trim()
  if (!v) return ''
  return v.charAt(0).toUpperCase() + v.slice(1)
}
