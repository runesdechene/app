/**
 * QUOI     — la phrase qu'on envoie en partageant un lieu : le texte réglé dans le Hub
 *            (share_text_template) où {name} devient le nom du lieu.
 * POURQUOI — un texte vide, blanc ou sans {name} ne dirait pas de quel lieu on parle : on garde alors la
 *            phrase d'origine. `split`/`join` plutôt que `replaceAll` : avec une chaîne de remplacement,
 *            `$&` ou `$'` dans un nom de lieu seraient interprétés. Même règle dans les pages SEO et
 *            l'aperçu du Hub.
 */
export function phraseDePartage(modele: string | null, nom: string): string {
  if (modele === null || modele.trim() === '' || !modele.includes('{name}')) {
    return `J’ai trouvé ${nom} sur Runes de Chêne EXPLORE - tu connais ?`
  }
  return modele.split('{name}').join(nom)
}
