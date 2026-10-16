/**
 * QUOI     — le texte d'un article (Markdown) en HTML sûr, avec un bouton d'appel facultatif à la fin.
 * POURQUOI — le HTML part chez Shopify : il passe par DOMPurify, et un lien qui n'est pas http(s)
 *            (javascript:…) n'est jamais écrit.
 */
import DOMPurify from 'dompurify'
import { marked } from 'marked'

export type Appel = { url: string; libelle: string }

const ECHAPPEMENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const echapper = (t: string) => t.replace(/[&<>"]/g, (c) => ECHAPPEMENT[c] ?? c)

export function versHtml(md: string, appel?: Appel): string {
  const corps = marked.parse(md, { async: false, breaks: true, gfm: true })
  const url = appel?.url.trim() ?? ''
  const lien = appel && /^https?:\/\//i.test(url)
    ? `<p><a href="${echapper(url)}">${echapper(appel.libelle.trim() || url)}</a></p>`
    : ''
  return DOMPurify.sanitize(corps + lien)
}
