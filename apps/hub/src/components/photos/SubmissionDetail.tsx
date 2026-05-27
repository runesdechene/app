// apps/hub/src/components/photos/SubmissionDetail.tsx
// Panneau détail d'une soumission : en-tête, visu photo-par-photo, curation, message, tags, barre d'actions adaptative.
import { useState } from 'react'
import {
  isVideoUrl, STATUS_COLORS, STATUS_LABELS, ROLE_COLORS, ROLE_LABELS,
  type PhotoSubmission, type PhotoStatus, type PhotoTag,
} from './types'
import { ImageCurator } from './ImageCurator'
import type { ShopifyProductHit } from '../../lib/shopifyProducts'

interface SubmissionDetailProps {
  submission: PhotoSubmission
  allTags: PhotoTag[]
  crowns: number
  onCrowns: (n: number) => void
  onModerate: (status: PhotoStatus, crowns?: number) => void
  onDelete: () => void
  onSaveMessage: (msg: string | null) => void
  onAddTag: (tagId: string) => void
  onRemoveTag: (tagId: string) => void
  onSetImageStatus: (imageId: string, status: PhotoStatus) => void
  onLinkImage: (imageId: string, hit: ShopifyProductHit) => Promise<void>
  onUnlinkImage: (imageId: string) => Promise<void>
  onOpenLightbox: (index: number) => void
  onDownloadSubmission: () => void
  onDownloadImage: (index: number) => void
}

export function SubmissionDetail(props: SubmissionDetailProps) {
  const { submission: sub, allTags } = props
  const images = [...sub.hub_submission_images].sort((a, b) => a.sort_order - b.sort_order)
  const [activeIdx, setActiveIdx] = useState(0)
  const [editingMsg, setEditingMsg] = useState(false)
  const [msgText, setMsgText] = useState(sub.message || '')
  const [tagOpen, setTagOpen] = useState(false)

  const active = images[activeIdx] || images[0]
  const availableTags = allTags.filter(t => !sub.tags.some(st => st.id === t.id))

  return (
    <div className="mod-detail">
      <div className="mod-detail__head">
        <div className="mod-detail__id">
          <div className="mod-detail__name-row">
            <span className="mod-detail__name">{sub.submitter_name}</span>
            {sub.submitter_role && <span className="mod-badge" style={{ backgroundColor: ROLE_COLORS[sub.submitter_role] }}>{ROLE_LABELS[sub.submitter_role]}</span>}
            <span className="mod-badge" style={{ backgroundColor: STATUS_COLORS[sub.status] }}>{STATUS_LABELS[sub.status]}</span>
            {sub.consent_brand_usage && <span className="mod-badge mod-badge--consent">Diffusion OK</span>}
          </div>
          <div className="mod-detail__contact">
            <span>{sub.submitter_email}</span>
            {sub.submitter_instagram && <span>{sub.submitter_instagram}</span>}
            {(sub.location_name || sub.location_zip) && <span>{[sub.location_name, sub.location_zip].filter(Boolean).join(' — ')}</span>}
            {sub.departement && <span>Département : {sub.departement}</span>}
            {sub.quest_ref && <span>⚑ {sub.quest_ref}</span>}
            <span>{new Date(sub.created_at).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>
        <button className="mod-detail__dl-all" onClick={props.onDownloadSubmission}>⬇ Tout télécharger</button>
      </div>

      {active && (
        <div className="mod-viewer">
          <div className="mod-viewer__main" onClick={() => props.onOpenLightbox(activeIdx)}>
            {isVideoUrl(active.image_url)
              ? <video src={active.image_url} muted playsInline />
              : <img src={active.image_url} alt="" />}
            <span className="mod-viewer__count">{activeIdx + 1} / {images.length}</span>
          </div>
          {images.length > 1 && (
            <div className="mod-strip">
              {images.map((img, i) => (
                <button key={img.id} className={`mod-strip__thumb${i === activeIdx ? ' is-active' : ''}`} onClick={() => setActiveIdx(i)}>
                  {isVideoUrl(img.image_url) ? <video src={img.image_url} muted /> : <img src={img.image_url} alt="" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {active && (
        <ImageCurator
          key={active.id}
          image={active}
          onOpenLightbox={() => props.onOpenLightbox(activeIdx)}
          onSetStatus={(status) => props.onSetImageStatus(active.id, status)}
          onLink={(hit) => props.onLinkImage(active.id, hit)}
          onUnlink={() => props.onUnlinkImage(active.id)}
          onDownload={() => props.onDownloadImage(activeIdx)}
        />
      )}

      {(sub.product_size || sub.model_height_cm || sub.model_shoulder_width_cm) && (
        <div className="mod-detail__sizing">
          {sub.product_size && <span className="mod-chip">Taille : {sub.product_size}</span>}
          {sub.model_height_cm && <span className="mod-chip">Hauteur : {sub.model_height_cm} cm</span>}
          {sub.model_shoulder_width_cm && <span className="mod-chip">Épaules : {sub.model_shoulder_width_cm} cm</span>}
        </div>
      )}

      {editingMsg ? (
        <div className="mod-detail__msg-edit">
          <textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={3} maxLength={500} autoFocus />
          <div className="mod-detail__msg-actions">
            <button className="mod-btn mod-btn--approve" onClick={() => { props.onSaveMessage(msgText.trim() || null); setEditingMsg(false) }}>Enregistrer</button>
            <button className="mod-btn" onClick={() => { setEditingMsg(false); setMsgText(sub.message || '') }}>Annuler</button>
          </div>
        </div>
      ) : (
        <p className="mod-detail__msg" onClick={() => { setEditingMsg(true); setMsgText(sub.message || '') }} title="Cliquer pour modifier">
          {sub.message || <span className="mod-detail__msg-empty">+ Ajouter un message…</span>}
        </p>
      )}

      <div className="mod-detail__tags">
        {sub.tags.map(tag => (
          <span key={tag.id} className="mod-tag" onClick={() => props.onRemoveTag(tag.id)} title="Retirer">#{tag.name} ✕</span>
        ))}
        <button className="mod-tag-add" onClick={() => setTagOpen(!tagOpen)}>+ tag</button>
        {tagOpen && (
          <div className="mod-tag-dropdown">
            {availableTags.map(tag => (
              <button key={tag.id} onClick={() => { props.onAddTag(tag.id); setTagOpen(false) }}>#{tag.name}</button>
            ))}
            {availableTags.length === 0 && <span className="mod-tag-dropdown__empty">Aucun tag dispo</span>}
          </div>
        )}
      </div>

      {sub.status === 'pending' && (
        <div className="mod-actionbar">
          <span>🪙</span>
          <input type="number" min={0} value={props.crowns} onChange={e => props.onCrowns(Math.max(0, parseInt(e.target.value || '0', 10)))} className="mod-crowninput" />
          <button className="mod-btn mod-btn--approve" onClick={() => props.onModerate('approved', props.crowns)}>Valider +{props.crowns}</button>
          <button className="mod-btn mod-btn--archive" onClick={() => props.onModerate('archived')}>Archiver</button>
          <button className="mod-btn mod-btn--danger" onClick={props.onDelete}>Supprimer</button>
        </div>
      )}
      {sub.status === 'approved' && (
        <div className="mod-actionbar">
          <button className="mod-btn mod-btn--archive" onClick={() => props.onModerate('archived')}>Archiver</button>
          <button className="mod-btn mod-btn--danger" onClick={props.onDelete}>Supprimer</button>
        </div>
      )}
      {sub.status === 'archived' && (
        <div className="mod-actionbar">
          <span>🪙</span>
          <input type="number" min={0} value={props.crowns} onChange={e => props.onCrowns(Math.max(0, parseInt(e.target.value || '0', 10)))} className="mod-crowninput" />
          <button className="mod-btn mod-btn--approve" onClick={() => props.onModerate('approved', props.crowns)}>Re-valider +{props.crowns}</button>
          <button className="mod-btn mod-btn--danger" onClick={props.onDelete}>Supprimer</button>
        </div>
      )}
    </div>
  )
}
