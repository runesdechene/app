import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
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
  pact_question: string | null
  promo_code: string | null
  promo_note: string | null
  starts_at: string | null
  ends_at: string | null
  reward_hint: string | null
  salon_intro: string | null
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

  useEffect(() => { void fetchMissions() }, [])

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
          pact_question: (row.pact_question as string | null) ?? null,
          promo_code: (row.promo_code as string | null) ?? null,
          promo_note: (row.promo_note as string | null) ?? null,
          starts_at: (row.starts_at as string | null) ?? null,
          ends_at: (row.ends_at as string | null) ?? null,
          reward_hint: (row.reward_hint as string | null) ?? null,
          salon_intro: (row.salon_intro as string | null) ?? null,
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
      const { error } = await supabase.from('missions').upsert(dirty)
      if (error) { setSaveError(error.message); return }
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
    if (!slug) { setNewSlugError('Slug invalide'); return }
    if (missions.some(m => m.slug === slug)) { setNewSlugError('Ce slug existe déjà'); return }
    setNewSlugError(null)
    setCreating(true)
    const { error } = await supabase.from('missions').insert({ slug, title: raw, status: 'draft' })
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
        {/* ── Liste ── */}
        <aside className="missions-admin-list">
          <div className="missions-create">
            <input
              type="text"
              className="missions-create-input"
              placeholder="Slug ou titre…"
              value={newSlug}
              onChange={e => { setNewSlug(e.target.value); setNewSlugError(null) }}
              onKeyDown={e => e.key === 'Enter' && void handleCreate()}
              disabled={creating}
            />
            <button className="missions-create-btn" onClick={() => void handleCreate()} disabled={creating || !newSlug.trim()}>
              {creating ? '…' : '+ Nouvelle'}
            </button>
          </div>
          {newSlugError && <p className="missions-create-error">{newSlugError}</p>}

          <div className="missions-list">
            {missions.length === 0 && <p className="missions-empty-list">Aucune mission.</p>}
            {missions.map(m => {
              const isDirty = JSON.stringify(m) !== JSON.stringify(savedMissions.find(s => s.slug === m.slug))
              return (
                <button
                  key={m.slug}
                  type="button"
                  className={`missions-list-item${selectedSlug === m.slug ? ' active' : ''}`}
                  onClick={() => setSelectedSlug(m.slug)}
                >
                  {m.emblem && <span className="missions-list-emblem">{m.emblem}</span>}
                  <span className="missions-list-text">
                    <span className="missions-list-name">
                      {m.title || m.slug}{isDirty && <span className="missions-dot">●</span>}
                    </span>
                    <span className="missions-list-slug">{m.slug}</span>
                  </span>
                  <span className="missions-status-pill" style={{ background: STATUS_COLORS[m.status] + '22', color: STATUS_COLORS[m.status] }}>
                    {STATUS_LABELS[m.status]}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        {/* ── Éditeur ── */}
        <div className="missions-admin-editor">
          {selectedMission === null ? (
            <div className="missions-editor-empty">Sélectionnez une mission ou créez-en une nouvelle.</div>
          ) : (
            <MissionEditor
              mission={selectedMission}
              onUpdate={(field, value) => updateField(selectedMission.slug, field, value)}
              onDelete={() => void handleDelete(selectedMission.slug)}
            />
          )}
        </div>
      </div>

      <SaveBar hasChanges={hasChanges} saving={saving} error={saveError} onSave={() => void handleSave()} onCancel={handleCancel} />
    </div>
  )
}

// ─── Editor ───────────────────────────────────────────────────────────────────

interface MissionEditorProps {
  mission: Mission
  onUpdate: <K extends keyof Mission>(field: K, value: Mission[K]) => void
  onDelete: () => void
}

function MissionEditor({ mission, onUpdate, onDelete }: MissionEditorProps) {
  const [uploading, setUploading] = useState(false)

  async function handleCoverUpload(file: File) {
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `mission-covers/${mission.slug}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('home-banners').upload(path, file, { upsert: true, contentType: file.type })
      if (error) { window.alert('Téléversement échoué : ' + error.message); return }
      const { data } = supabase.storage.from('home-banners').getPublicUrl(path)
      onUpdate('cover_image_url', data.publicUrl)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div className="missions-editor-head">
        <h2>{mission.emblem ? `${mission.emblem} ` : ''}{mission.title || mission.slug}</h2>
        <span className="missions-status-pill" style={{ background: STATUS_COLORS[mission.status] + '22', color: STATUS_COLORS[mission.status] }}>
          {STATUS_LABELS[mission.status]}
        </span>
        <button type="button" className="missions-admin-delete" onClick={onDelete}>Supprimer</button>
      </div>

      <Card title="Identité">
        <div className="missions-grid">
          <Field label="Titre"><input type="text" value={mission.title} onChange={e => onUpdate('title', e.target.value)} placeholder="Nom de la mission" /></Field>
          <Field label="Emblème" narrow><input type="text" value={mission.emblem ?? ''} onChange={e => onUpdate('emblem', e.target.value || null)} placeholder="⚔️" /></Field>
          <Field label="Eyebrow (surtitre)"><input type="text" value={mission.eyebrow ?? ''} onChange={e => onUpdate('eyebrow', e.target.value || null)} placeholder="Mission à thème" /></Field>
          <Field label="Call (accroche)"><input type="text" value={mission.call ?? ''} onChange={e => onUpdate('call', e.target.value || null)} placeholder="Accroche courte" /></Field>
          <Field label="Slug (non modifiable)"><input type="text" value={mission.slug} readOnly /></Field>
          <Field label="Image de couverture" full>
            <div className="missions-cover-row">
              <input type="url" value={mission.cover_image_url ?? ''} onChange={e => onUpdate('cover_image_url', e.target.value || null)} placeholder="Colle une URL, ou téléverse →" />
              <label className={`missions-upload-btn${uploading ? ' is-uploading' : ''}`}>
                {uploading ? 'Envoi…' : '📤 Téléverser'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleCoverUpload(f); e.target.value = '' }}
                />
              </label>
            </div>
            {mission.cover_image_url && <img className="missions-cover-preview" src={mission.cover_image_url} alt="" />}
          </Field>
        </div>
      </Card>

      <Card title="Brief & livrable">
        <div className="missions-grid">
          <Field label="Brief" full>
            <textarea rows={4} value={mission.brief ?? ''} onChange={e => onUpdate('brief', e.target.value || null)} placeholder="Ce qui est demandé aux joueurs…" />
          </Field>
          <Field label="Type de livrable">
            <select value={mission.deliverable_kind} onChange={e => onUpdate('deliverable_kind', e.target.value as DeliverableKind)}>
              {(Object.entries(DELIVERABLE_LABELS) as [DeliverableKind, string][]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      <Card title="Produit & CTA">
        <div className="missions-grid">
          <Field label="Produit Shopify lié (optionnel)" full>
            <MissionProductPicker value={mission.product_handle} onChange={h => onUpdate('product_handle', h)} />
          </Field>
          <Field label="Label du bouton"><input type="text" value={mission.cta_label ?? ''} onChange={e => onUpdate('cta_label', e.target.value || null)} placeholder="Rejoindre la boutique" /></Field>
          <Field label="URL du bouton"><input type="url" value={mission.cta_url ?? ''} onChange={e => onUpdate('cta_url', e.target.value || null)} placeholder="https://…" /></Field>
        </div>
      </Card>

      <Card title="Pacte & code promo">
        <div className="missions-grid">
          <Field label="Question du pacte" full>
            <input type="text" value={mission.pact_question ?? ''} onChange={e => onUpdate('pact_question', e.target.value || null)} placeholder="As-tu déjà au moins un produit de la collection grecque ?" />
            <span className="missions-hint">Posée au clic « Je relève ce défi » (si la mission a un bouton boutique). Vide → « As-tu déjà de quoi accomplir cette mission ? ».</span>
          </Field>
          <Field label="Code promo (optionnel)"><input type="text" value={mission.promo_code ?? ''} onChange={e => onUpdate('promo_code', e.target.value || null)} placeholder="GREC10" /></Field>
          <Field label="Descriptif du code" full>
            <input type="text" value={mission.promo_note ?? ''} onChange={e => onUpdate('promo_note', e.target.value || null)} placeholder="−10% sur toute la collection grecque" />
            <span className="missions-hint">Si le joueur répond « pas encore », ce descriptif + le code s'affichent avant la boutique. Code vide → étape sautée.</span>
          </Field>
        </div>
      </Card>

      <Card title="Fenêtre temporelle">
        <div className="missions-grid">
          <Field label="Début"><input type="datetime-local" value={toDatetimeLocal(mission.starts_at)} onChange={e => onUpdate('starts_at', fromDatetimeLocal(e.target.value))} /></Field>
          <Field label="Fin"><input type="datetime-local" value={toDatetimeLocal(mission.ends_at)} onChange={e => onUpdate('ends_at', fromDatetimeLocal(e.target.value))} /></Field>
        </div>
      </Card>

      <Card title="Récompense">
        <div className="missions-grid">
          <Field label="Mention récompense" full>
            <input type="text" value={mission.reward_hint ?? ''} onChange={e => onUpdate('reward_hint', e.target.value || null)} placeholder="🎁 Cadeau & code de réduction offert" />
            <span className="missions-hint">Le butin réel (Gloire + Couronnes + cadeau + code) se fixe à la validation des contributions — ce champ n'est qu'une mention affichée aux joueurs.</span>
          </Field>
        </div>
      </Card>

      <Card title="Salon">
        <div className="missions-grid">
          <Field label="Mot d'accueil du salon" full>
            <textarea rows={3} value={mission.salon_intro ?? ''} onChange={e => onUpdate('salon_intro', e.target.value || null)} placeholder="Message épinglé en tête du salon…" />
          </Field>
        </div>
      </Card>

      <Card title="Diffusion">
        <div className="missions-grid">
          <Field label="Statut">
            <select value={mission.status} onChange={e => onUpdate('status', e.target.value as MissionStatus)}>
              {(Object.entries(STATUS_LABELS) as [MissionStatus, string][]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
      </Card>
    </>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="missions-card">
      <h3 className="missions-card-title">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, full, narrow, children }: { label: string; full?: boolean; narrow?: boolean; children: ReactNode }) {
  return (
    <div className={`missions-field${full ? ' full' : ''}${narrow ? ' narrow' : ''}`}>
      <label>{label}</label>
      {children}
    </div>
  )
}
