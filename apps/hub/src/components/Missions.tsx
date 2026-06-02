import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SaveBar } from './SaveBar'
import { MissionProductPicker } from './missions/MissionProductPicker'
import './missions/Missions.css'

type DeliverableKind = 'photo' | 'video' | 'other'
type MissionStatus = 'draft' | 'published' | 'passed' | 'archived'

interface Mission {
  slug: string
  title: string
  eyebrow: string | null
  call: string | null
  brief: string | null
  emblem: string | null
  cover_image_url: string | null
  deliverable_kind: DeliverableKind
  product_handle: string | null
  cta_label: string | null
  cta_url: string | null
  starts_at: string | null
  ends_at: string | null
  reward_hint: string | null
  salon_intro: string | null
  notify_on_launch: boolean
  featured_on_home: boolean
  status: MissionStatus
  created_at: string
}

const STATUS_LABELS: Record<MissionStatus, string> = {
  draft: 'Brouillon',
  published: 'Publiée',
  passed: 'Passée',
  archived: 'Archivée',
}

const STATUS_COLORS: Record<MissionStatus, string> = {
  draft: '#8A7B6A',
  published: '#2e7d32',
  passed: '#1565c0',
  archived: '#555',
}

const DELIVERABLE_LABELS: Record<DeliverableKind, string> = {
  photo: 'Photo',
  video: 'Vidéo',
  other: 'Autre',
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Convert ISO string to datetime-local value (no seconds)
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

// Convert datetime-local value to ISO string (or null if empty)
function fromDatetimeLocal(value: string): string | null {
  if (!value) return null
  try {
    return new Date(value).toISOString()
  } catch {
    return null
  }
}

export function Missions() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [savedMissions, setSavedMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [newSlugError, setNewSlugError] = useState<string | null>(null)

  const hasChanges = JSON.stringify(missions) !== JSON.stringify(savedMissions)

  useEffect(() => {
    void fetchMissions()
  }, [])

  async function fetchMissions() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        const mapped = (data as Record<string, unknown>[]).map(row => ({
          slug: String(row.slug ?? ''),
          title: String(row.title ?? ''),
          eyebrow: (row.eyebrow as string | null) ?? null,
          call: (row.call as string | null) ?? null,
          brief: (row.brief as string | null) ?? null,
          emblem: (row.emblem as string | null) ?? null,
          cover_image_url: (row.cover_image_url as string | null) ?? null,
          deliverable_kind: ((row.deliverable_kind as DeliverableKind) ?? 'photo'),
          product_handle: (row.product_handle as string | null) ?? null,
          cta_label: (row.cta_label as string | null) ?? null,
          cta_url: (row.cta_url as string | null) ?? null,
          starts_at: (row.starts_at as string | null) ?? null,
          ends_at: (row.ends_at as string | null) ?? null,
          reward_hint: (row.reward_hint as string | null) ?? null,
          salon_intro: (row.salon_intro as string | null) ?? null,
          notify_on_launch: Boolean(row.notify_on_launch ?? false),
          featured_on_home: Boolean(row.featured_on_home ?? false),
          status: ((row.status as MissionStatus) ?? 'draft'),
          created_at: String(row.created_at ?? ''),
        })) satisfies Mission[]
        setMissions(mapped)
        setSavedMissions(JSON.parse(JSON.stringify(mapped)))
      }
    } finally {
      setLoading(false)
    }
  }

  function updateField<K extends keyof Mission>(slug: string, field: K, value: Mission[K]) {
    setMissions(prev => prev.map(m => m.slug === slug ? { ...m, [field]: value } : m))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const dirty = missions.filter(m => {
        const saved = savedMissions.find(s => s.slug === m.slug)
        return JSON.stringify(m) !== JSON.stringify(saved)
      })
      if (dirty.length === 0) return

      const { error } = await supabase.from('missions').upsert(
        dirty.map(m => ({
          slug: m.slug,
          title: m.title,
          eyebrow: m.eyebrow,
          call: m.call,
          brief: m.brief,
          emblem: m.emblem,
          cover_image_url: m.cover_image_url,
          deliverable_kind: m.deliverable_kind,
          product_handle: m.product_handle,
          cta_label: m.cta_label,
          cta_url: m.cta_url,
          starts_at: m.starts_at,
          ends_at: m.ends_at,
          reward_hint: m.reward_hint,
          salon_intro: m.salon_intro,
          notify_on_launch: m.notify_on_launch,
          featured_on_home: m.featured_on_home,
          status: m.status,
        }))
      )
      if (error) {
        setSaveError(error.message)
        return
      }
      await fetchMissions()
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setMissions(JSON.parse(JSON.stringify(savedMissions)))
    setSaveError(null)
  }

  async function handleCreate() {
    const raw = newSlug.trim()
    const slug = slugify(raw)
    if (!slug) {
      setNewSlugError('Slug invalide')
      return
    }
    if (missions.some(m => m.slug === slug)) {
      setNewSlugError('Ce slug existe déjà')
      return
    }
    setNewSlugError(null)
    setCreating(true)
    const now = new Date().toISOString()
    const newMission: Mission = {
      slug,
      title: raw,
      eyebrow: null,
      call: null,
      brief: null,
      emblem: null,
      cover_image_url: null,
      deliverable_kind: 'photo',
      product_handle: null,
      cta_label: null,
      cta_url: null,
      starts_at: null,
      ends_at: null,
      reward_hint: null,
      salon_intro: null,
      notify_on_launch: false,
      featured_on_home: false,
      status: 'draft',
      created_at: now,
    }
    const { error } = await supabase.from('missions').insert({
      slug: newMission.slug,
      title: newMission.title,
      deliverable_kind: newMission.deliverable_kind,
      notify_on_launch: newMission.notify_on_launch,
      featured_on_home: newMission.featured_on_home,
      status: newMission.status,
    })
    if (!error) {
      await fetchMissions()
      setSelectedSlug(slug)
      setNewSlug('')
    } else {
      setNewSlugError(error.message)
    }
    setCreating(false)
  }

  async function handleDelete(slug: string) {
    if (!window.confirm(`Supprimer la mission « ${slug} » ?`)) return
    const { error } = await supabase.from('missions').delete().eq('slug', slug)
    if (!error) {
      if (selectedSlug === slug) setSelectedSlug(null)
      await fetchMissions()
    }
  }

  const selectedMission = missions.find(m => m.slug === selectedSlug) ?? null

  if (loading) return <div className="loading">Chargement...</div>

  return (
    <div className="missions-admin" style={{ paddingBottom: hasChanges ? 80 : 0 }}>
      <div className="page-header">
        <h1>Missions</h1>
        <span className="tags-count">{missions.length} mission{missions.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="missions-admin-layout">
        {/* ── Liste gauche ── */}
        <div className="missions-admin-list">
          {/* Création */}
          <div className="faction-create" style={{ marginBottom: 12 }}>
            <input
              type="text"
              className="faction-create-input"
              placeholder="Slug ou titre de la mission..."
              value={newSlug}
              onChange={e => { setNewSlug(e.target.value); setNewSlugError(null) }}
              onKeyDown={e => e.key === 'Enter' && void handleCreate()}
              disabled={creating}
            />
            <button
              className="faction-create-btn"
              onClick={() => void handleCreate()}
              disabled={creating || !newSlug.trim()}
            >
              {creating ? '...' : '+ Nouvelle Mission'}
            </button>
          </div>
          {newSlugError && (
            <p style={{ color: '#c0392b', fontSize: 12, margin: '-8px 0 8px' }}>{newSlugError}</p>
          )}

          {/* Liste */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {missions.length === 0 && (
              <p style={{ opacity: 0.5, fontSize: 13 }}>Aucune mission.</p>
            )}
            {missions.map(m => {
              const isDirty = JSON.stringify(m) !== JSON.stringify(savedMissions.find(s => s.slug === m.slug))
              return (
                <button
                  key={m.slug}
                  type="button"
                  onClick={() => setSelectedSlug(m.slug)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: selectedSlug === m.slug ? '2px solid #8A7B6A' : '1px solid rgba(138,123,106,0.25)',
                    background: selectedSlug === m.slug ? 'rgba(138,123,106,0.12)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  {m.emblem && <span style={{ fontSize: 18 }}>{m.emblem}</span>}
                  <span style={{ flex: 1, overflow: 'hidden' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.title || m.slug}
                      {isDirty && <span style={{ marginLeft: 5, color: '#e0a73d', fontSize: 11 }}>●</span>}
                    </span>
                    <span style={{ fontSize: 11, opacity: 0.55 }}>{m.slug}</span>
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 999,
                      background: STATUS_COLORS[m.status] + '22',
                      color: STATUS_COLORS[m.status],
                      flexShrink: 0,
                    }}
                  >
                    {STATUS_LABELS[m.status]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Éditeur droite ── */}
        <div className="missions-admin-editor">
          {selectedMission === null ? (
            <div style={{ opacity: 0.4, fontSize: 14, marginTop: 40, textAlign: 'center' }}>
              Sélectionnez une mission ou créez-en une nouvelle.
            </div>
          ) : (
            <MissionEditor
              mission={selectedMission}
              onUpdate={(field, value) => updateField(selectedMission.slug, field, value)}
              onDelete={() => void handleDelete(selectedMission.slug)}
            />
          )}
        </div>
      </div>

      <SaveBar
        hasChanges={hasChanges}
        saving={saving}
        error={saveError}
        onSave={() => void handleSave()}
        onCancel={handleCancel}
      />
    </div>
  )
}

// ─── Sub-component : editor ───────────────────────────────────────────────────

interface MissionEditorProps {
  mission: Mission
  onUpdate: <K extends keyof Mission>(field: K, value: Mission[K]) => void
  onDelete: () => void
}

function MissionEditor({ mission, onUpdate, onDelete }: MissionEditorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header éditeur */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>
          {mission.emblem && <span style={{ marginRight: 8 }}>{mission.emblem}</span>}
          {mission.title || mission.slug}
        </h2>
        <button
          type="button"
          className="faction-delete-btn"
          onClick={onDelete}
          style={{ marginLeft: 12 }}
        >
          Supprimer
        </button>
      </div>

      {/* Slug (lecture seule) */}
      <div className="faction-field">
        <label className="faction-field-label">Slug (non modifiable)</label>
        <input
          type="text"
          className="faction-title-input"
          value={mission.slug}
          readOnly
          style={{ opacity: 0.5, cursor: 'default' }}
        />
      </div>

      {/* ── GROUPE : Identité ── */}
      <SectionLabel>Identité</SectionLabel>

      <div className="faction-field">
        <label className="faction-field-label">Titre</label>
        <input
          type="text"
          className="faction-title-input"
          value={mission.title}
          onChange={e => onUpdate('title', e.target.value)}
          placeholder="Nom de la mission"
        />
      </div>

      <div className="faction-field">
        <label className="faction-field-label">Eyebrow (surtitre)</label>
        <input
          type="text"
          className="faction-title-input"
          value={mission.eyebrow ?? ''}
          onChange={e => onUpdate('eyebrow', e.target.value || null)}
          placeholder="ex: Mission saisonnière"
        />
      </div>

      <div className="faction-field">
        <label className="faction-field-label">Call (accroche)</label>
        <input
          type="text"
          className="faction-title-input"
          value={mission.call ?? ''}
          onChange={e => onUpdate('call', e.target.value || null)}
          placeholder="Accroche courte"
        />
      </div>

      <div className="faction-field">
        <label className="faction-field-label">Emblème (emoji)</label>
        <input
          type="text"
          className="faction-title-input"
          value={mission.emblem ?? ''}
          onChange={e => onUpdate('emblem', e.target.value || null)}
          placeholder="🌿"
          style={{ width: 80 }}
        />
      </div>

      <div className="faction-field">
        <label className="faction-field-label">Image de couverture (URL)</label>
        <input
          type="url"
          className="faction-title-input"
          value={mission.cover_image_url ?? ''}
          onChange={e => onUpdate('cover_image_url', e.target.value || null)}
          placeholder="https://..."
        />
        {mission.cover_image_url && (
          <img
            src={mission.cover_image_url}
            alt=""
            style={{ marginTop: 6, maxHeight: 120, borderRadius: 6, objectFit: 'cover', maxWidth: '100%' }}
          />
        )}
      </div>

      {/* ── GROUPE : Brief & Livrable ── */}
      <SectionLabel>Brief & Livrable</SectionLabel>

      <div className="faction-field">
        <label className="faction-field-label">Brief</label>
        <textarea
          className="faction-description-input"
          rows={4}
          value={mission.brief ?? ''}
          onChange={e => onUpdate('brief', e.target.value || null)}
          placeholder="Description de la mission..."
        />
      </div>

      <div className="faction-field">
        <label className="faction-field-label">Type de livrable</label>
        <select
          className="faction-title-input"
          value={mission.deliverable_kind}
          onChange={e => onUpdate('deliverable_kind', e.target.value as DeliverableKind)}
        >
          {(Object.entries(DELIVERABLE_LABELS) as [DeliverableKind, string][]).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>

      {/* ── GROUPE : Produit + CTA ── */}
      <SectionLabel>Produit & CTA</SectionLabel>

      <div className="faction-field">
        <label className="faction-field-label">Produit Shopify lié</label>
        <MissionProductPicker
          value={mission.product_handle}
          onChange={h => onUpdate('product_handle', h)}
        />
      </div>

      <div className="faction-field">
        <label className="faction-field-label">Label du bouton CTA</label>
        <input
          type="text"
          className="faction-title-input"
          value={mission.cta_label ?? ''}
          onChange={e => onUpdate('cta_label', e.target.value || null)}
          placeholder="ex: Voir le produit"
        />
      </div>

      <div className="faction-field">
        <label className="faction-field-label">URL CTA</label>
        <input
          type="url"
          className="faction-title-input"
          value={mission.cta_url ?? ''}
          onChange={e => onUpdate('cta_url', e.target.value || null)}
          placeholder="https://..."
        />
      </div>

      {/* ── GROUPE : Fenêtre temporelle ── */}
      <SectionLabel>Fenêtre temporelle</SectionLabel>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div className="faction-field" style={{ flex: 1, minWidth: 200 }}>
          <label className="faction-field-label">Début</label>
          <input
            type="datetime-local"
            className="faction-title-input"
            value={toDatetimeLocal(mission.starts_at)}
            onChange={e => onUpdate('starts_at', fromDatetimeLocal(e.target.value))}
          />
        </div>
        <div className="faction-field" style={{ flex: 1, minWidth: 200 }}>
          <label className="faction-field-label">Fin</label>
          <input
            type="datetime-local"
            className="faction-title-input"
            value={toDatetimeLocal(mission.ends_at)}
            onChange={e => onUpdate('ends_at', fromDatetimeLocal(e.target.value))}
          />
        </div>
      </div>

      {/* ── GROUPE : Récompense ── */}
      <SectionLabel>Récompense</SectionLabel>

      <div className="faction-field">
        <label className="faction-field-label">Indice récompense (reward_hint)</label>
        <input
          type="text"
          className="faction-title-input"
          value={mission.reward_hint ?? ''}
          onChange={e => onUpdate('reward_hint', e.target.value || null)}
          placeholder="🎁 Cadeau & code de réduction offert"
        />
        <p style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>
          Le butin réel (Gloire + Couronnes + cadeau + code) se fixe à la validation des contributions — ce champ est un indice visible librement.
        </p>
      </div>

      {/* ── GROUPE : Salon ── */}
      <SectionLabel>Salon</SectionLabel>

      <div className="faction-field">
        <label className="faction-field-label">Intro du salon</label>
        <textarea
          className="faction-description-input"
          rows={3}
          value={mission.salon_intro ?? ''}
          onChange={e => onUpdate('salon_intro', e.target.value || null)}
          placeholder="Message d'introduction affiché dans le salon de la mission..."
        />
      </div>

      {/* ── GROUPE : Diffusion ── */}
      <SectionLabel>Diffusion</SectionLabel>

      <div className="faction-field">
        <label className="faction-field-label">Statut</label>
        <select
          className="faction-title-input"
          value={mission.status}
          onChange={e => onUpdate('status', e.target.value as MissionStatus)}
          style={{ color: STATUS_COLORS[mission.status] }}
        >
          {(Object.entries(STATUS_LABELS) as [MissionStatus, string][]).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>

      <div className="faction-field" style={{ display: 'flex', gap: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={mission.notify_on_launch}
            onChange={e => onUpdate('notify_on_launch', e.target.checked)}
          />
          Notifier au lancement
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={mission.featured_on_home}
            onChange={e => onUpdate('featured_on_home', e.target.checked)}
          />
          Mise en avant (accueil)
        </label>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#8A7B6A',
      borderBottom: '1px solid rgba(138,123,106,0.25)',
      paddingBottom: 4,
      marginTop: 20,
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}
