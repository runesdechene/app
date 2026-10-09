/**
 * QUOI     — l'heure d'un pin, à la française : « 14 h 32 ».
 * POURQUOI — la liste des pins et l'écran « Pin posé » la disent pareil (maquettes 2 et 3).
 */
export function heure(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: 'numeric', minute: '2-digit' }).replace(':', ' h ')
}
