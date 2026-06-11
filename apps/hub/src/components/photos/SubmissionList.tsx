// apps/hub/src/components/photos/SubmissionList.tsx
// File master : une ligne par soumission (vignette · nom · méta · pastille statut).
import { isVideoUrl, STATUS_COLORS, type PhotoSubmission } from './types'

interface SubmissionListProps {
  submissions: PhotoSubmission[]
  selectedId: string | null
  onSelect: (id: string) => void
  missionTitles: Record<string, string>
}

export function SubmissionList({ submissions, selectedId, onSelect, missionTitles }: SubmissionListProps) {
  return (
    <div className="mod-list">
      {submissions.map(sub => {
        const imgs = [...sub.hub_submission_images].sort((a, b) => a.sort_order - b.sort_order)
        const first = imgs[0]
        return (
          <button
            key={sub.id}
            className={`mod-row${selectedId === sub.id ? ' is-selected' : ''}`}
            onClick={() => onSelect(sub.id)}
          >
            <div className="mod-row__thumb">
              {first
                ? (isVideoUrl(first.image_url)
                    ? <video src={first.image_url} muted playsInline />
                    : <img src={first.image_url} alt="" />)
                : <div className="mod-row__thumb-empty" />}
            </div>
            <div className="mod-row__info">
              <span className="mod-row__name">{sub.submitter_name}</span>
              {sub.quest_ref && (
                <span className="mod-row__quest" title={`Rattachée à la mission : ${missionTitles[sub.quest_ref] ?? sub.quest_ref}`}>
                  ⚑ {missionTitles[sub.quest_ref] ?? sub.quest_ref}
                </span>
              )}
              <span className="mod-row__meta">
                {imgs.length > 1 && <span>{imgs.length} fichiers</span>}
                {sub.tags.length > 0 && <span>#{sub.tags.length}</span>}
                {sub.consent_brand_usage && <span title="Diffusion OK">✓</span>}
                <span>{new Date(sub.created_at).toLocaleDateString('fr-FR')}</span>
              </span>
            </div>
            <span className="mod-row__dot" style={{ backgroundColor: STATUS_COLORS[sub.status] }} />
          </button>
        )
      })}
    </div>
  )
}
