/**
 * QUOI     — les mentions « @Nom » : repérer celle qu'on est en train de taper, l'insérer une
 *            fois choisie, et découper un message pour afficher ses mentions en liens.
 * POURQUOI — le message reste du texte simple (la V1 lit la même table) ; ce qui est mentionné
 *            vient de la base (migration 373), avec l'identifiant de chacun. Fonctions pures.
 */
export type Mention = { id: string; nom: string }
export type Morceau = { texte: string } | { mention: Mention }

// La mention en cours : un « @ » en début de texte ou après une espace, puis jusqu'au curseur — les
// espaces comprises (« @le mar » pour « Le Marcheur de Plumes », Uriel 01/10), 40 caractères au plus.
// Une fois un nom choisi et suivi d'une espace, la mention est finie : la suite est le message.
export function mentionEnCours(texte: string, curseur: number, choisis: readonly string[] = []) {
  const avant = texte.slice(0, curseur)
  const m = /(^|\s)@([^@\n]{0,40})$/.exec(avant)
  if (!m) return null
  const recherche = m[2] ?? ''
  if (choisis.some((nom) => recherche.startsWith(`${nom} `))) return null
  return { debut: curseur - recherche.length - 1, recherche }
}

// Remplace la mention en cours par « @Nom » suivi d'une espace ; rend le texte et le curseur.
export function insererMention(texte: string, curseur: number, nom: string) {
  const enCours = mentionEnCours(texte, curseur)
  if (!enCours) return { texte, curseur }
  // Une espace suit toujours le nom — sans la doubler s'il y en a déjà une.
  const apres = texte.slice(curseur)
  const insere = apres.startsWith(' ') ? `@${nom}` : `@${nom} `
  return {
    texte: texte.slice(0, enCours.debut) + insere + apres,
    curseur: enCours.debut + `@${nom} `.length,
  }
}

// Découpe un message : le texte, et les « @Nom » des personnes mentionnées.
export function decouper(texte: string, mentions: Mention[]): Morceau[] {
  if (mentions.length === 0) return [{ texte }]
  const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Les noms les plus longs d'abord : « @Gautier de Bilskimir » avant « @Gautier ».
  const noms = [...mentions].sort((a, b) => b.nom.length - a.nom.length)
  const motif = new RegExp(`@(${noms.map((m) => echapper(m.nom)).join('|')})`, 'g')
  const morceaux: Morceau[] = []
  let depuis = 0
  for (const trouve of texte.matchAll(motif)) {
    const mention = noms.find((m) => m.nom === trouve[1])
    if (!mention) continue
    if (trouve.index > depuis) morceaux.push({ texte: texte.slice(depuis, trouve.index) })
    morceaux.push({ mention })
    depuis = trouve.index + trouve[0].length
  }
  if (depuis < texte.length) morceaux.push({ texte: texte.slice(depuis) })
  return morceaux
}
