import { useEffect, useRef } from 'react'
import changelogRaw from '../../../../CHANGELOG.md?raw'
import { safeStorage } from '../../../lib/safeStorage'
import { usePlayerStore } from '../../../stores/playerStore'
import { useChangelogStore } from '../../../stores/changelogStore'
import './VersionBadge.css'

/**
 * Render bold/italic from our own CHANGELOG.md (trusted source, not user input).
 * Uses React elements instead of dangerouslySetInnerHTML.
 */
function renderMarkdown(text: string) {
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

type LineEntry =
  | { type: 'bullet'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }

interface VersionBlock {
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

const versions = parseChangelog(changelogRaw)
const current = versions[0]
const SEEN_KEY = 'changelog_seen_version'

/** Format compact pour le mini badge sur le logo : "0.7.12" depuis "ALPHA V0.7.12" */
function shortVersion(v: string): string {
  const m = v.match(/V?(\d+\.\d+\.\d+)/)
  return m ? m[1] : v
}

interface VersionBadgeProps {
  /** 'overlay' (default) : posé en absolute par-dessus le logo dans la top
   *  bar mobile. 'floating' : fixed en bas à droite, pour les contextes sans
   *  logo (desktop carte). */
  variant?: 'overlay' | 'floating'
}

/**
 * Mini badge cliquable. Au clic, ouvre le ChangelogModal via le store. Sur
 * mobile, posé par-dessus le logo (variant overlay). Sur desktop, en floating
 * bas-droite (variant floating).
 */
export function VersionBadge({ variant = 'overlay' }: VersionBadgeProps = {}) {
  const open = useChangelogStore(s => s.open)
  if (!current) return null
  return (
    <button
      type="button"
      className={`version-badge version-badge-${variant}`}
      onClick={(e) => { e.stopPropagation(); open() }}
      aria-label={`Voir le changelog (${current.version})`}
    >
      {shortVersion(current.version)}
    </button>
  )
}

/**
 * Modal changelog séparé. Monté une seule fois dans RequireAuth, écoute le
 * store. Auto-open au mount si l'utilisateur n'a pas encore vu cette version
 * (et que le tuto est complété — ne pas polluer l'arrivée d'un nouveau).
 */
export function ChangelogModal() {
  const isOpen = useChangelogStore(s => s.isOpen)
  const openStore = useChangelogStore(s => s.open)
  const close = useChangelogStore(s => s.close)
  // Subscribe au store : le check d'auto-open doit attendre que le store
  // soit hydraté avec la vraie valeur (initialement null, mis à jour par
  // usePlayer après fetch DB). Sans ça, le useEffect se lance trop tôt et
  // l'auto-open n'arrive jamais. (Bug repéré V0.8.0.)
  const tutorialCompletedAt = usePlayerStore(s => s.tutorialCompletedAt)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    if (!current) return
    if (tutorialCompletedAt === null) return
    checkedRef.current = true
    const seen = safeStorage.get(SEEN_KEY)
    if (seen !== current.version) openStore()
  }, [tutorialCompletedAt, openStore])

  function handleClose() {
    if (current) safeStorage.set(SEEN_KEY, current.version)
    close()
  }

  async function forceUpdate() {
    try {
      // 1. Désinstalle le Service Worker pour qu'il télécharge le nouveau au prochain load
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      // 2. Vide tous les caches du PWA
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      // ignore — on recharge dans tous les cas
    }
    // 3. Hard reload (bypass cache navigateur)
    window.location.reload()
  }

  if (!current || !isOpen) return null

  return (
    <div className="version-modal-overlay" onClick={handleClose}>
      <div className="version-modal" onClick={e => e.stopPropagation()}>
        <div className="version-modal-header">
          <h2>{current.version}</h2>
          <button className="version-modal-close" onClick={handleClose}>
            &#10005;
          </button>
        </div>
        {current.title && <h3 className="version-modal-title">{current.title}</h3>}
        <div className="version-modal-content">
          {current.lines.map((entry, i) => {
            if (entry.type === 'heading') return <h4 key={i} className="version-modal-section">{entry.text}</h4>
            if (entry.type === 'paragraph') return <p key={i} className="version-modal-paragraph">{renderMarkdown(entry.text)}</p>
            return <p key={i} className="version-modal-bullet">— {renderMarkdown(entry.text)}</p>
          })}
        </div>

        <div className="version-modal-update">
          <button className="version-modal-update-btn" onClick={forceUpdate}>
            🔄 Forcer la mise à jour
          </button>
          <small>Si tu ne vois pas la dernière version, ce bouton recharge l'app proprement.</small>
        </div>

        {versions.length > 1 && (
          <div className="version-modal-history">
            {versions.slice(1, 4).map((v, i) => (
              <details key={i}>
                <summary>{v.version}{v.title ? ` — ${v.title}` : ''}</summary>
                <div className="version-modal-content">
                  {v.lines.map((entry, j) => {
                    if (entry.type === 'heading') return <h4 key={j} className="version-modal-section">{entry.text}</h4>
                    if (entry.type === 'paragraph') return <p key={j} className="version-modal-paragraph">{renderMarkdown(entry.text)}</p>
                    return <p key={j} className="version-modal-bullet">— {renderMarkdown(entry.text)}</p>
                  })}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
