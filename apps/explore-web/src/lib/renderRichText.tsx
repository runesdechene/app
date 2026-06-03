import type { ReactNode } from 'react'

/**
 * Rendu d'un sous-ensemble Markdown sûr pour les descriptions de lieu :
 * **gras**, *italique*, sauts de ligne, et listes à puces (`- ` ou `* `).
 *
 * Tout passe par des nœuds React (jamais dangerouslySetInnerHTML) → le texte
 * utilisateur est échappé par React, pas d'injection HTML possible.
 */

// Parse les marqueurs inline (**gras**, *italique*) d'une ligne en nœuds React.
function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let lastIndex = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) nodes.push(text.slice(lastIndex, m.index))
    if (m[2] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{m[2]}</strong>)
    } else if (m[3] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-i${i}`}>{m[3]}</em>)
    }
    lastIndex = m.index + m[0].length
    i++
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function renderRichText(text: string): ReactNode {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let listItems: string[] = []
  let key = 0

  function flushList() {
    if (listItems.length === 0) return
    const items = listItems
    const k = key++
    blocks.push(
      <ul key={`ul${k}`} className="rich-ul">
        {items.map((it, idx) => <li key={idx}>{parseInline(it, `ul${k}li${idx}`)}</li>)}
      </ul>,
    )
    listItems = []
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      listItems.push(bullet[1])
    } else {
      flushList()
      if (line.trim() === '') {
        blocks.push(<div key={`gap${key++}`} className="rich-gap" />)
      } else {
        const k = key++
        blocks.push(<p key={`p${k}`} className="rich-p">{parseInline(line, `p${k}`)}</p>)
      }
    }
  }
  flushList()
  return blocks
}
