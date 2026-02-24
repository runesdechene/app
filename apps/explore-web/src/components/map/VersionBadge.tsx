import { useState } from 'react'
import changelogRaw from '../../../CHANGELOG.md?raw'

interface VersionBlock {
  version: string
  title: string
  lines: string[]
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
    } else if (trimmed.startsWith('- ') && current) {
      current.lines.push(trimmed.slice(2).trim())
    }
  }

  return blocks
}

const versions = parseChangelog(changelogRaw)
const current = versions[0]

export function VersionBadge() {
  const [open, setOpen] = useState(false)

  if (!current) return null

  return (
    <>
      <button className="version-badge" onClick={() => setOpen(true)}>
        {current.version}
      </button>

      {open && (
        <div className="version-modal-overlay" onClick={() => setOpen(false)}>
          <div className="version-modal" onClick={e => e.stopPropagation()}>
            <div className="version-modal-header">
              <h2>{current.version}</h2>
              <button className="version-modal-close" onClick={() => setOpen(false)}>
                &#10005;
              </button>
            </div>
            {current.title && <h3 className="version-modal-title">{current.title}</h3>}
            <ul className="version-modal-list">
              {current.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>

            {versions.length > 1 && (
              <div className="version-modal-history">
                {versions.slice(1).map((v, i) => (
                  <details key={i}>
                    <summary>{v.version}{v.title ? ` — ${v.title}` : ''}</summary>
                    <ul>
                      {v.lines.map((line, j) => (
                        <li key={j}>{line}</li>
                      ))}
                    </ul>
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
