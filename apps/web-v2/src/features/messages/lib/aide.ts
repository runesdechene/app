/**
 * QUOI     — l'invite du champ quand on écrit dans une Compagnie : « Écrire au Lys de Fer ».
 * POURQUOI — l'article se contracte comme on le dit à voix haute (Le → au, Les → aux).
 */
export function aideDuChamp(nom: string): string {
  if (nom.startsWith('Le ')) return `Écrire au ${nom.slice(3)}`
  if (nom.startsWith('Les ')) return `Écrire aux ${nom.slice(4)}`
  return `Écrire à ${nom}`
}
