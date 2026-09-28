/**
 * QUOI     — de petits lecteurs pour le JSON renvoyé par les fonctions de la base.
 * POURQUOI — une fonction SQL qui renvoie `json` arrive typée `Json` : n'importe quoi pour le
 *            compilateur. Chaque lecteur rend la valeur attendue ou lève une erreur ; l'appelant
 *            attrape l'erreur et décide (profil introuvable, préférences illisibles…).
 *            Aucun « cast » : le type est prouvé, pas supposé.
 */
export type Objet = Record<string, unknown>

function estObjet(v: unknown): v is Objet {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function objet(v: unknown): Objet {
  if (!estObjet(v)) throw new Error('objet attendu')
  return v
}

export function chaine(v: unknown): string {
  if (typeof v !== 'string') throw new Error('texte attendu')
  return v
}

export function nombre(v: unknown): number {
  if (typeof v !== 'number') throw new Error('nombre attendu')
  return v
}

export function booleen(v: unknown): boolean {
  if (typeof v !== 'boolean') throw new Error('booléen attendu')
  return v
}

export function ouNull<T>(lire: (v: unknown) => T) {
  return (v: unknown): T | null => (v === null ? null : lire(v))
}

export function liste<T>(lire: (v: unknown) => T) {
  return (v: unknown): T[] => {
    if (!Array.isArray(v)) throw new Error('liste attendue')
    return v.map(lire)
  }
}
