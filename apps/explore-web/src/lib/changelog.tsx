import changelogRaw from '../../CHANGELOG.md?raw'
import { safeStorage } from './safeStorage'

/**
 * Source unique du changelog : parsing de CHANGELOG.md + helpers « vu / non
 * vu ». Réutilisé par la modale (VersionBadge), l'onglet « Mise à jour » de la
 * leftbar desktop et la carte d'accueil mobile.
 */

export type LineEntry =
  | { type: 'bullet'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }

export interface VersionBlock {
  version: string
  title: string
  lines: LineEntry[]
}

function parseChangelog(raw: string): VersionBlock[] {
  const blocks: VersionBlock[] = []
  let current: VersionBlock | null = null

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('# ')) {
      current = { version: trimmed.slice(2).trim(), title: '', lines: [] }
      blocks.push(current)
    } else if (trimmed.startsWith('## ') && current) {
      current.title = trimmed.slice(3).trim()
    } else if (trimmed.startsWith('### ') && current) {
      current.lines.push({ type: 'heading', text: trimmed.slice(4).trim() })
    } else if (trimmed.startsWith('- ') && current) {
      current.lines.push({ type: 'bullet', text: trimmed.slice(2).trim() })
    } else if (trimmed.length > 0 && current) {
      current.lines.push({ type: 'paragraph', text: trimmed })
    }
  }

  return blocks
}

export const changelogVersions = parseChangelog(changelogRaw)
export const currentChangelog: VersionBlock | undefined = changelogVersions[0]

const SEEN_KEY = 'changelog_seen_version'

/** True si la version courante n'a pas encore été vue par l'utilisateur. */
export function isChangelogUnseen(): boolean {
  if (!currentChangelog) return false
  return safeStorage.get(SEEN_KEY) !== currentChangelog.version
}

/** Marque la version courante comme vue (cache le badge « nouveau »). */
export function markChangelogSeen(): void {
  if (currentChangelog) safeStorage.set(SEEN_KEY, currentChangelog.version)
}

/** Format compact "0.9.67" depuis "ALPHA V0.9.67". */
export function shortVersion(v: string): string {
  const m = v.match(/V?(\d+\.\d+\.\d+)/)
  return m ? m[1] : v
}

/**
 * Rend le gras/italique de NOTRE CHANGELOG.md (source de confiance, pas une
 * entrée utilisateur) en éléments React plutôt qu'en dangerouslySetInnerHTML.
 */
export function renderMarkdown(text: string) {
  const parts: (string | JSX.Element)[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    if (match[1]) parts.push(<strong key={key++}>{match[1]}</strong>)
    else if (match[2]) parts.push(<em key={key++}>{match[2]}</em>)
    lastIndex = re.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
}
