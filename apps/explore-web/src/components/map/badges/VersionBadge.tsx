import { useState } from 'react'
import changelogRaw from '../../../../CHANGELOG.md?raw'
import { safeStorage } from '../../../lib/safeStorage'
import { usePlayerStore } from '../../../stores/playerStore'
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

export function VersionBadge() {
  // Fresh user (tutorial pas encore terminé) : pas d'auto-open du changelog,
  // ça pollue l'arrivée dans le jeu. Le badge reste cliquable s'il veut le lire.
  const [open, setOpen] = useState(() => {
    if (!current) return false
    if (usePlayerStore.getState().tutorialCompletedAt === null) return false
    const seen = safeStorage.get(SEEN_KEY)
    return seen !== current.version
  })

  function handleClose() {
    if (current) safeStorage.set(SEEN_KEY, current.version)
    setOpen(false)
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

  if (!current) return null

  return (
    <>
      <button className="version-badge" onClick={() => setOpen(true)}>
        {current.version}
      </button>

      {open && (
        <div className="version-modal-overlay" onClick={() => handleClose()}>
          <div className="version-modal" onClick={e => e.stopPropagation()}>
            <div className="version-modal-header">
              <h2>{current.version}</h2>
              <button className="version-modal-close" onClick={() => handleClose()}>
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
      )}
    </>
  )
}
