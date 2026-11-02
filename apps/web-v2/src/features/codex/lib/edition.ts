/**
 * QUOI     — le libellé d'une marque d'édition : « Édition limitée », « Retiré », « Exclusif … ».
 * POURQUOI — la base rend la marque et sa précision, l'appli écrit la phrase (règle supabase.md).
 *            Une marque vraie seulement, jamais une rareté inventée (Uriel, 02/11).
 */
export type Edition = 'limitee' | 'retire' | 'exclusif'

const LIBELLES: Record<Edition, string> = {
  limitee: 'Édition limitée',
  retire: 'Retiré',
  exclusif: 'Exclusif',
}

export function libelleEdition(edition: Edition | null, precision: string | null): string | null {
  if (!edition) return null
  return precision ? `${LIBELLES[edition]} ${precision}` : LIBELLES[edition]
}
