import { useState } from 'react'
import type { NearbyPlanter } from '../../../types/veille'

interface Props {
  candidates: NearbyPlanter[]
  /** Nom par défaut pré-rempli (ex. « Expédition de {nom} »). */
  defaultName?: string
  onCancel: () => void
  onConfirm: (selectedIds: string[], expeditionName: string) => void
}

export function VeillePartageeModal({ candidates, defaultName = '', onCancel, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [name, setName] = useState(defaultName)

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="veille-partagee-modal-overlay" onClick={onCancel}>
      <div className="veille-partagee-modal" onClick={e => e.stopPropagation()}>
        <h3>Planter avec des compagnons</h3>
        {candidates.length === 0 ? (
          <p>Personne d'autre n'est connecté à proximité pour l'instant. Tu peux planter seul.</p>
        ) : (
          <p>
            {candidates.length} voyageur{candidates.length > 1 ? 's' : ''} à proximité.
            Sélectionne ceux qui plantent avec toi — ils rejoindront l'expédition et seront marqués comme ayant visité le lieu.
          </p>
        )}

        {candidates.length > 0 && (
          <ul className="veille-partagee-modal-list">
            {candidates.map(c => (
              <li key={c.userId}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(c.userId)}
                    onChange={() => toggle(c.userId)}
                  />
                  <img src={c.avatarUrl ?? '/res/default-avatar.png'} alt="" />
                  <span className="veille-partagee-modal-name">{c.displayName.trim()}</span>
                  <span
                    className="veille-partagee-modal-faction"
                    style={{ color: c.factionColor ?? '#8a6f4a' }}
                    title={c.factionId}
                  >
                    ●
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <label className="veille-partagee-modal-name-label">
          Nom de l'expédition
          <input
            type="text"
            className="veille-partagee-modal-name-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={defaultName || 'Nom de l\'expédition'}
            maxLength={60}
          />
        </label>

        <div className="veille-partagee-modal-actions">
          <button onClick={() => onConfirm([], name)} className="veille-partagee-modal-secondary">
            Planter seul
          </button>
          <button
            onClick={() => onConfirm(Array.from(selected), name)}
            disabled={selected.size === 0}
          >
            Planter ensemble ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}
