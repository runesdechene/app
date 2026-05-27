// apps/hub/src/components/photos/PhotosToolbar.tsx
// Barre d'outils : filtres statut/rôle/tags, recherche, gestion des tags, téléchargement ZIP.
import { STATUS_LABELS, ROLE_LABELS, type PhotoStatus, type SubmitterRole, type PhotoTag } from './types'

interface PhotosToolbarProps {
  filter: PhotoStatus | 'all'
  onFilter: (f: PhotoStatus | 'all') => void
  roleFilter: 'all' | SubmitterRole
  onRoleFilter: (r: 'all' | SubmitterRole) => void
  tagFilter: 'all' | string
  onTagFilter: (t: 'all' | string) => void
  tags: PhotoTag[]
  search: string
  onSearch: (s: string) => void
  pendingCount: number
  onToggleTagManager: () => void
  downloadSince: string
  onDownloadSince: (v: string) => void
  downloadCount: { subs: number; files: number }
  isDownloading: boolean
  downloadProgress: string
  onDownloadZip: () => void
}

const STATUS_FILTERS: (PhotoStatus | 'all')[] = ['pending', 'approved', 'archived', 'all']
const ROLE_FILTERS: ('all' | SubmitterRole)[] = ['all', 'client', 'ambassadeur', 'partenaire']

export function PhotosToolbar(p: PhotosToolbarProps) {
  return (
    <div className="mod-toolbar">
      <div className="mod-toolbar__row">
        <div className="mod-seg">
          {STATUS_FILTERS.map(f => (
            <button key={f} className={`mod-seg__btn${p.filter === f ? ' is-on' : ''}`} onClick={() => p.onFilter(f)}>
              {f === 'all' ? 'Toutes' : STATUS_LABELS[f]}{f === 'pending' && p.pendingCount > 0 ? ` · ${p.pendingCount}` : ''}
            </button>
          ))}
        </div>
        <input className="mod-search" type="search" placeholder="Rechercher un nom, un email…" value={p.search} onChange={e => p.onSearch(e.target.value)} />
        <a className="mod-toolbar__formlink" href="/soumettre-contenu" target="_blank" rel="noopener noreferrer">Ouvrir le formulaire ↗</a>
      </div>

      <div className="mod-toolbar__row mod-toolbar__filters">
        <div className="mod-chips">
          {ROLE_FILTERS.map(r => (
            <button key={r} className={`mod-chip-btn${p.roleFilter === r ? ' is-on' : ''}`} onClick={() => p.onRoleFilter(r)}>
              {r === 'all' ? 'Tous rôles' : ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        {p.tags.length > 0 && (
          <div className="mod-chips">
            <button className={`mod-chip-btn${p.tagFilter === 'all' ? ' is-on' : ''}`} onClick={() => p.onTagFilter('all')}>Tous tags</button>
            {p.tags.map(tag => (
              <button key={tag.id} className={`mod-chip-btn${p.tagFilter === tag.id ? ' is-on' : ''}`} onClick={() => p.onTagFilter(tag.id)}>#{tag.name}</button>
            ))}
          </div>
        )}
        <button className="mod-chip-btn" onClick={p.onToggleTagManager}>Gérer les tags</button>
      </div>

      <div className="mod-toolbar__row mod-download">
        <label>Télécharger depuis le :</label>
        <input type="date" value={p.downloadSince} onChange={e => p.onDownloadSince(e.target.value)} />
        {p.downloadSince && <span className="mod-download__count">{p.downloadCount.subs} soumission(s) · {p.downloadCount.files} fichier(s)</span>}
        <button className="mod-btn" disabled={p.isDownloading || p.downloadCount.files === 0} onClick={p.onDownloadZip}>
          {p.isDownloading ? p.downloadProgress : 'Télécharger (.zip)'}
        </button>
        {p.downloadSince && <button className="mod-download__clear" onClick={() => p.onDownloadSince('')}>✕</button>}
      </div>
    </div>
  )
}
