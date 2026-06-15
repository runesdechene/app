import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

// Liens EXTERNES du corps -> nouvel onglet + rel sécurisé. Enregistré une seule
// fois. No-op hors navigateur (tests node) où addHook n'est pas disponible.
// Garde sur http(s) : un éventuel lien interne ne serait pas forcé en _blank.
if (typeof DOMPurify.addHook === 'function') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && /^https?:\/\//i.test(node.getAttribute('href') ?? '')) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
}

/**
 * Rendu Markdown → HTML sanitisé (DOMPurify — défense en profondeur, le contenu
 * est rédigé en admin mais affiché à tous les joueurs). DOMPurify ne fonctionne
 * qu'avec un DOM : en navigateur (où le XSS compte vraiment) il sanitise ; en
 * environnement node (tests) il n'est pas initialisé → passthrough.
 */
export function renderMarkdown(md: string): string {
  const raw = marked.parse(md ?? '', { async: false }) as string
  return typeof DOMPurify.sanitize === 'function' ? DOMPurify.sanitize(raw) : raw
}

/** Extrait texte brut (cartes liste / méta), syntaxe markdown retirée, longueur bornée. */
export function excerpt(md: string, max = 140): string {
  const plain = (md ?? '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')   // liens -> texte
    .replace(/[#>*_`~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? plain.slice(0, max - 1).trimEnd() + '…' : plain
}
