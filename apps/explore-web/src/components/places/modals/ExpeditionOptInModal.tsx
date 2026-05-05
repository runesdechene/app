import { useState } from 'react'
import type { NearbyPlanter } from '../../../types/veille'

interface Props {
  candidates: NearbyPlanter[]
  onCancel: () => void
  onConfirm: (selectedIds: string[]) => void
}

export function ExpeditionOptInModal({ candidates, onCancel, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="expedition-modal-overlay" onClick={onCancel}>
      <div className="expedition-modal" onClick={e => e.stopPropagation()}>
        <h3>Tu n'es pas seul ici</h3>
        <p>
          {candidates.length} autre{candidates.length > 1 ? 's' : ''} voyageur{candidates.length > 1 ? 's sont' : ' est'} sur place. Planter ensemble ?
        </p>
        <ul className="expedition-modal-list">
          {candidates.map(c => (
            <li key={c.userId}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(c.userId)}
                  onChange={() => toggle(c.userId)}
                />
                <img src={c.avatarUrl ?? '/res/default-avatar.png'} alt="" />
                <span className="expedition-modal-name">{c.displayName.trim()}</span>
                <span
                  className="expedition-modal-faction"
                  style={{ color: c.factionColor ?? '#8a6f4a' }}
                  title={c.factionId}
                >
                  ●
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="expedition-modal-actions">
          <button onClick={() => onConfirm([])} className="expedition-modal-secondary">
            Planter seul
          </button>
          <button
            onClick={() => onConfirm(Array.from(selected))}
            disabled={selected.size === 0}
          >
            Planter ensemble ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}
