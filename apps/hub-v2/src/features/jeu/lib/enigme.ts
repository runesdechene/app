/**
 * QUOI     — le brouillon d'une énigme : ses règles de validité et sa forme à l'envoi.
 * POURQUOI — les mêmes règles, dans le même ordre et avec les mêmes messages que hub_enregistrer_enigme
 *            (mig 519) : l'erreur s'affiche avant l'envoi, et la base refuse si on la contourne.
 */
export const DIFFICULTES = { very_easy: 'Très facile', easy: 'Facile', medium: 'Moyenne', hard: 'Difficile' }
export type Difficulte = keyof typeof DIFFICULTES

export type Brouillon = {
  culture: string | null; difficulte: Difficulte; recit: string; question: string; format: 'qcm' | 'free'
  choix: string[]; reponse: string; variantes: string; explication: string; active: boolean
}

const rogner = (liste: string[]) => liste.map((t) => t.trim()).filter((t) => t !== '')
const lignes = (texte: string) => rogner(texte.split('\n'))

export function erreurDEnigme(b: Brouillon): string | null {
  const reponse = b.reponse.trim()
  if (b.question.trim() === '') return 'La question est vide'
  if (reponse === '') return 'La réponse est vide'
  if (b.format === 'qcm') {
    const choix = rogner(b.choix)
    if (choix.length < 2) return 'Il faut au moins deux choix'
    if (!choix.includes(reponse)) return 'La réponse doit être l’un des choix'
    return null
  }
  if (/[{}]/.test(reponse) || lignes(b.variantes).some((v) => /[{}]/.test(v))) return 'Une réponse ou une variante contient une accolade'
  return null
}

// Les arguments de hub_enregistrer_enigme, sans p_id (créer) ni p_culture (universelle) : la base lit leur absence.
export function versEnvoi(b: Brouillon) {
  return {
    p_difficulte: b.difficulte, p_recit: b.recit, p_question: b.question, p_format: b.format,
    p_choix: b.format === 'qcm' ? rogner(b.choix) : null, p_reponse: b.reponse,
    p_variantes: b.format === 'free' ? lignes(b.variantes) : [], p_explication: b.explication, p_active: b.active,
    ...(b.culture !== null && { p_culture: b.culture }),
  }
}
