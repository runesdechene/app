import { useEffect, useState, type ReactNode, type ChangeEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SaveBar } from '../SaveBar'
import { renderMarkdown } from '../../lib/markdown'
import { defaultPushText, defaultInstaCaption, CHANNEL_LABELS } from '../../lib/announcementChannels'
import type { Announcement, AnnouncementType, Channel } from '../../types/announcement'
import './ComposerAnnonce.css'

type Tab = 'corps' | 'push' | 'insta'

function deepCopy<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export function ComposerAnnonce() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) return <NewAnnouncementForm onCreated={(newId) => navigate(`/annonces/${newId}`)} />
  return <ComposerEditor id={id} />
}

function ComposerEditor({ id }: { id: string }) {
  const [ann, setAnn] = useState<Announcement | null>(null)
  const [saved, setSaved] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('corps')
  const [busyChannel, setBusyChannel] = useState<Channel | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)

  const hasChanges = JSON.stringify(ann) !== JSON.stringify(saved)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data, error: e } = await supabase.from('announcements').select('*').eq('id', id).single()
        if (cancelled) return
        if (e) { setError(e.message); return }
        const row = data as Announcement
        setAnn(deepCopy(row))
        setSaved(deepCopy(row))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  function setField<K extends keyof Announcement>(field: K, value: Announcement[K]) {
    setAnn((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  async function refetch() {
    const { data } = await supabase.from('announcements').select('*').eq('id', id).single()
    if (data) {
      setAnn(deepCopy(data as Announcement))
      setSaved(deepCopy(data as Announcement))
    }
  }

  async function handleSave() {
    if (!ann) return
    setSaving(true); setError(null)
    try {
      const { data, error: e } = await supabase.rpc('update_announcement', {
        p_id: ann.id,
        p_title: ann.title,
        p_body: ann.body,
        p_cover_image: ann.cover_image,
        p_push_text: ann.push_text,
        p_insta_caption: ann.insta_caption,
        p_type: ann.type,
        p_cta_url: ann.cta_url,
        p_cta_label: ann.cta_label,
      })
      if (e) { setError(e.message); return }
      const row = data as Announcement
      setAnn(deepCopy(row))
      setSaved(deepCopy(row))
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setAnn(saved ? deepCopy(saved) : null)
    setError(null)
  }

  async function doPublishApp() {
    if (!ann) return
    setBusyChannel('app'); setError(null)
    try {
      const { error: e } = await supabase.rpc('publish_announcement', { p_id: ann.id })
      if (e) { setError(e.message); return }
      await refetch()
    } finally {
      setBusyChannel(null)
    }
  }

  async function doBlog() {
    if (!ann) return
    setBusyChannel('blog'); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token
      const resp = await fetch('/.netlify/functions/shopify-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          announcement: { title: ann.title, body_html: renderMarkdown(ann.body), cover_image: ann.cover_image, type: ann.type },
          shopify_article_id: ann.shopify_article_id,
        }),
      })
      const out = await resp.json() as { error?: string; article_id?: string }
      if (!resp.ok) { setError(out.error || 'Erreur Shopify'); return }
      await supabase.rpc('set_announcement_channel', {
        p_id: ann.id, p_channel: 'blog', p_state: 'published', p_shopify_article_id: out.article_id ?? null,
      })
      await refetch()
    } finally {
      setBusyChannel(null)
    }
  }

  async function doPush() {
    if (!ann) return
    if (!window.confirm('Envoyer un push à TOUS les abonnés opt-in ? Action irréversible.')) return
    setBusyChannel('push'); setError(null)
    try {
      const { data, error: e } = await supabase.rpc('broadcast_announcement_push', { p_id: ann.id })
      if (e) { setError(e.message); return }
      const recipients = (data as { recipients?: number } | null)?.recipients ?? '?'
      window.alert(`Push envoyé à ${recipients} abonnés.`)
      await refetch()
    } finally {
      setBusyChannel(null)
    }
  }

  async function markInstaReady() {
    if (!ann) return
    await supabase.rpc('set_announcement_channel', { p_id: ann.id, p_channel: 'insta', p_state: 'ready' })
    await refetch()
  }

  async function handleCoverUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadingCover(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop() || 'webp'
      const path = `cover-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('announcement-covers')
        .upload(path, file, { contentType: file.type })
      if (upErr) { setError(`Erreur upload : ${upErr.message}`); return }
      const { data: urlData } = supabase.storage.from('announcement-covers').getPublicUrl(path)
      setField('cover_image', urlData.publicUrl)
    } finally {
      setUploadingCover(false)
    }
  }

  if (loading) return <div className="loading">Chargement…</div>
  if (!ann) return <div className="loading">Annonce introuvable. {error}</div>

  const instaCaption = defaultInstaCaption(ann)
  const pushPreview = defaultPushText(ann)
  const isPublished = ann.status === 'published'

  return (
    <div className="composer" style={{ paddingBottom: hasChanges ? 70 : 0 }}>
      <div className="page-header">
        <h1>{ann.title || 'Annonce'}</h1>
        <span className={`composer-status composer-status--${ann.status}`}>{ann.status}</span>
      </div>

      <div className="composer-tabs">
        {(['corps', 'push', 'insta'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'corps' ? 'Corps' : t === 'push' ? 'Push' : 'Instagram'}
          </button>
        ))}
      </div>

      {tab === 'corps' && (
        <div className="composer-corps">
          <label>Type
            <select value={ann.type} onChange={(e) => setField('type', e.target.value as AnnouncementType)}>
              <option value="produit">Produit</option>
              <option value="app">App</option>
              <option value="marque">Marque</option>
            </select>
          </label>
          <label>Titre
            <input type="text" value={ann.title} onChange={(e) => setField('title', e.target.value)} />
          </label>
          <div className="composer-field">
            <span className="composer-field-label">Image de couverture</span>
            <div className="composer-cover">
              {ann.cover_image && <img className="composer-cover-thumb" src={ann.cover_image} alt="" />}
              <input id="cover-upload" className="composer-file-input" type="file" accept="image/*" onChange={handleCoverUpload} />
              <label htmlFor="cover-upload" className="composer-upload-btn">
                {uploadingCover ? 'Envoi…' : ann.cover_image ? "Changer l'image" : 'Choisir une image'}
              </label>
              {ann.cover_image && (
                <button type="button" className="composer-cover-remove" onClick={() => setField('cover_image', null)}>Retirer</button>
              )}
            </div>
          </div>
          <label>Corps (Markdown)
            <textarea rows={16} value={ann.body} onChange={(e) => setField('body', e.target.value)} />
          </label>
          <div className="composer-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(ann.body) }} />
          <label>Lien du bouton (CTA)
            <input
              type="url"
              placeholder="https://runesdechene.com/products/..."
              value={ann.cta_url ?? ''}
              onChange={(e) => setField('cta_url', e.target.value || null)}
            />
          </label>
          <label>Texte du bouton
            <input
              type="text"
              placeholder="Découvrir"
              value={ann.cta_label ?? ''}
              onChange={(e) => setField('cta_label', e.target.value || null)}
            />
          </label>
          {ann.cta_url && (
            <div className="composer-cta-preview">
              <span className="composer-field-label">Aperçu du bouton</span>
              <span className="composer-cta-btn">{(ann.cta_label || 'Découvrir')} →</span>
            </div>
          )}
        </div>
      )}

      {tab === 'push' && (
        <div className="composer-channel">
          <label>Texte du push (optionnel — défaut : 1re ligne du corps)
            <input type="text" maxLength={120} value={ann.push_text ?? ''} onChange={(e) => setField('push_text', e.target.value || null)} />
          </label>
          <p className="composer-hint">Aperçu : <strong>{ann.title}</strong> — {pushPreview}</p>
        </div>
      )}

      {tab === 'insta' && (
        <div className="composer-channel">
          <label>Légende Instagram (optionnel — défaut généré)
            <textarea rows={6} value={ann.insta_caption ?? ''} onChange={(e) => setField('insta_caption', e.target.value || null)} />
          </label>
          <div className="composer-insta-kit">
            <pre>{instaCaption}</pre>
            <button onClick={() => { void navigator.clipboard.writeText(instaCaption); void markInstaReady() }}>
              Copier la légende
            </button>
          </div>
        </div>
      )}

      <div className="composer-publish">
        <h2>Publication</h2>
        <ChannelRow label={CHANNEL_LABELS.app} state={ann.channels.app}
          action={<button disabled={busyChannel !== null} onClick={doPublishApp}>{isPublished ? 'Publié' : "Publier dans l'app"}</button>} />
        <ChannelRow label={CHANNEL_LABELS.blog} state={ann.channels.blog}
          action={<button disabled={!isPublished || busyChannel !== null} onClick={doBlog}>{ann.shopify_article_id ? 'Mettre à jour' : 'Publier'}</button>} />
        <ChannelRow label={CHANNEL_LABELS.push} state={ann.channels.push}
          action={<button disabled={!isPublished || busyChannel !== null} onClick={doPush}>Broadcast</button>} />
        <ChannelRow label={CHANNEL_LABELS.insta} state={ann.channels.insta}
          action={<span className="composer-hint">→ onglet Instagram (copier-coller)</span>} />
        <ChannelRow label={CHANNEL_LABELS.email} state={ann.channels.email}
          action={<span className="composer-hint">Phase 2 (Resend)</span>} />
      </div>

      {error && <p className="composer-error">{error}</p>}
      <SaveBar hasChanges={hasChanges} saving={saving} error={error} onSave={handleSave} onCancel={handleCancel} />
    </div>
  )
}

function ChannelRow({ label, state, action }: { label: string; state: string; action: ReactNode }) {
  return (
    <div className="channel-row">
      <span className="channel-name">{label}</span>
      <span className={`channel-state channel-state--${state}`}>{state}</span>
      <span className="channel-action">{action}</span>
    </div>
  )
}

function NewAnnouncementForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [type, setType] = useState<AnnouncementType>('produit')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function create() {
    setBusy(true); setErr(null)
    try {
      const { data, error } = await supabase.rpc('create_announcement', { p_type: type, p_title: title })
      if (error) { setErr(error.message); return }
      onCreated((data as Announcement).id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="composer-new">
      <h1>Nouvelle annonce</h1>
      <label>Type
        <select value={type} onChange={(e) => setType(e.target.value as AnnouncementType)}>
          <option value="produit">Produit</option>
          <option value="app">App</option>
          <option value="marque">Marque</option>
        </select>
      </label>
      <label>Titre / matière première
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Nouvelle broche Yggdrasil" />
      </label>
      <button disabled={busy || !title.trim()} onClick={create}>Créer le brouillon</button>
      {err && <p className="composer-error">{err}</p>}
    </div>
  )
}
