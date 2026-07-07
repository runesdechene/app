import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { ModTag, ModPlaceDetail } from './types'
import { TagPicker } from './TagPicker'

interface Props {
  placeId: string
  currentTags: ModTag[]        // tags de la ligne (ordre primary-first)
  allTags: ModTag[]
  onChanged: () => void        // refresh liste + compteurs après action
}

export function PlaceEditPanel({ placeId, currentTags, allTags, onChanged }: Props) {
  const [detail, setDetail] = useState<ModPlaceDetail | null>(null)
  const [tagIds, setTagIds] = useState<string[]>(currentTags.map(t => t.id))
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [sensible, setSensible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const loadDetail = useCallback(() => {
    let active = true
    supabase.rpc('mod_get_place', { p_place_id: placeId }).then(({ data }) => {
      if (!active || !data || (data as { error?: string }).error) return
      const d = data as ModPlaceDetail
      setDetail(d)
      setTitle(d.title ?? '')
      setText(d.text ?? '')
      setSensible(d.sensible)
    })
    return () => { active = false }
  }, [placeId])

  useEffect(() => {
    setDetail(null)
    return loadDetail()
  }, [placeId, loadDetail])

  async function call(fn: string, params: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null)
    try {
      const { data, error } = await supabase.rpc(fn, params)
      const err = error?.message ?? (data as { error?: string })?.error
      setMsg(err ? `Erreur : ${err}` : ok)
      if (!err) {
        onChanged()
        loadDetail()
      }
    } finally {
      setBusy(false)
    }
  }

  const saveTags = () => {
    if (tagIds.length < 1) { setMsg('Au moins 1 tag'); return }
    call('mod_set_place_tags', { p_place_id: placeId, p_tag_ids: tagIds }, 'Tags enregistrés')
  }
  const saveFields = () =>
    call('mod_update_place', { p_place_id: placeId, p_title: title, p_text: text, p_sensible: sensible }, 'Lieu mis à jour')
  const toggleVerified = () =>
    call('mod_set_verified', { p_place_id: placeId, p_verified: !detail?.verified_at }, 'Statut vérifié mis à jour')
  const toggleMasked = () =>
    call('mod_set_masked', { p_place_id: placeId, p_masked: !detail?.masked }, 'Visibilité mise à jour')

  if (!detail) return <div className="mod-panel"><span className="loading">Chargement…</span></div>

  const mapsUrl = `https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`

  return (
    <div className="mod-panel">
      <div>
        <h5>Tags (max 3 · 1er = principal, double-clic)</h5>
        <TagPicker allTags={allTags} selected={tagIds} onChange={setTagIds} />
        <button className="mod-btn" style={{ marginTop: 10 }} onClick={saveTags} disabled={busy}>
          Enregistrer les tags
        </button>

        <div className="mod-field" style={{ marginTop: 14 }}>
          <label>Titre</label>
          <input value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="mod-field">
          <label>Description</label>
          <textarea rows={3} value={text} onChange={e => setText(e.target.value)} />
        </div>
        <label className="mod-toggle">
          <input type="checkbox" checked={sensible} onChange={e => setSensible(e.target.checked)} />
          Marquer « sensible »
        </label>
        <button className="mod-btn" style={{ marginTop: 8 }} onClick={saveFields} disabled={busy}>
          Enregistrer titre / description
        </button>
      </div>

      <div>
        <h5>Contexte</h5>
        <div className="mod-infolist">
          <div><b>ID :</b> {detail.id}</div>
          <div><b>Auteur :</b> {detail.author_name ?? '?'} · {detail.author_places_count} lieux · {detail.author_contributions ?? 0} contrib.</div>
          <div><b>Créé :</b> {new Date(detail.created_at).toLocaleDateString('fr-FR')}</div>
          <div><b>Modifié :</b> {new Date(detail.updated_at).toLocaleDateString('fr-FR')}</div>
          <div><b>Adresse :</b> {detail.address || '—'}</div>
          <div><b>Coords :</b> {detail.latitude.toFixed(4)}, {detail.longitude.toFixed(4)} · <a href={mapsUrl} target="_blank" rel="noreferrer">Maps ↗</a></div>
          <div><b>Visites :</b> {detail.visit_count} · <b>Découvertes :</b> {detail.discovered_count}</div>
          <div><b>Photos :</b> {detail.photo_count} · <b>Note :</b> {detail.rating_avg ?? '—'} ({detail.rating_count})</div>
          <div><b>État :</b> {detail.masked ? 'masqué' : 'visible'}{detail.sensible ? ' · sensible' : ''}</div>
          <div><b>Vérif. :</b> {detail.verified_at ? `${detail.verified_by_name ?? ''} · ${new Date(detail.verified_at).toLocaleDateString('fr-FR')}` : 'jamais'}</div>
        </div>
      </div>

      <div className="mod-actions">
        <button className="mod-btn verify" onClick={toggleVerified} disabled={busy}>
          {detail.verified_at ? 'Retirer la vérification' : '✓ Marquer comme vérifié'}
        </button>
        <button className="mod-btn mask" onClick={toggleMasked} disabled={busy}>
          {detail.masked ? 'Démasquer' : 'Masquer de l\'app'}
        </button>
        {msg && <span className="mod-msg">{msg}</span>}
      </div>
    </div>
  )
}
