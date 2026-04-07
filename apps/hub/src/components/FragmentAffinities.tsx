import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SaveBar } from './SaveBar'

interface Affinity {
  fragment_id: number
  tag_id: string
  bonus_points: number
}

interface FragmentOption {
  id: number
  name: string
  collection: string | null
}

interface TagOption {
  id: string
  title: string
}

export function FragmentAffinities() {
  const [affinities, setAffinities] = useState<Affinity[]>([])
  const [saved, setSaved] = useState<Affinity[]>([])
  const [fragments, setFragments] = useState<FragmentOption[]>([])
  const [tags, setTags] = useState<TagOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // New affinity form
  const [newFragId, setNewFragId] = useState<number | ''>('')
  const [newTagId, setNewTagId] = useState('')
  const [newBonus, setNewBonus] = useState(3)

  useEffect(() => {
    Promise.all([
      supabase.from('fragment_tag_affinities').select('*'),
      supabase.from('title_fragments').select('id, name, collection').order('name'),
      supabase.from('tags').select('id, title').order('title'),
    ]).then(([affRes, fragRes, tagRes]) => {
      const a = (affRes.data ?? []) as Affinity[]
      setAffinities(a)
      setSaved(JSON.parse(JSON.stringify(a)))
      setFragments((fragRes.data ?? []) as FragmentOption[])
      setTags((tagRes.data ?? []) as TagOption[])
      setLoading(false)
    })
  }, [])

  const hasChanges = JSON.stringify(affinities) !== JSON.stringify(saved)

  async function handleSave() {
    setSaving(true)

    // Delete removed
    for (const s of saved) {
      if (!affinities.find(a => a.fragment_id === s.fragment_id && a.tag_id === s.tag_id)) {
        await supabase.from('fragment_tag_affinities')
          .delete()
          .eq('fragment_id', s.fragment_id)
          .eq('tag_id', s.tag_id)
      }
    }

    // Upsert current
    for (const a of affinities) {
      await supabase.from('fragment_tag_affinities')
        .upsert({ fragment_id: a.fragment_id, tag_id: a.tag_id, bonus_points: a.bonus_points },
          { onConflict: 'fragment_id,tag_id' })
    }

    setSaved(JSON.parse(JSON.stringify(affinities)))
    setSaving(false)
  }

  function addAffinity() {
    if (newFragId === '' || !newTagId) return
    if (affinities.find(a => a.fragment_id === newFragId && a.tag_id === newTagId)) return
    setAffinities([...affinities, { fragment_id: newFragId as number, tag_id: newTagId, bonus_points: newBonus }])
    setNewFragId('')
    setNewTagId('')
    setNewBonus(3)
  }

  function removeAffinity(fragId: number, tagId: string) {
    setAffinities(affinities.filter(a => !(a.fragment_id === fragId && a.tag_id === tagId)))
  }

  function updateBonus(fragId: number, tagId: string, bonus: number) {
    setAffinities(affinities.map(a =>
      a.fragment_id === fragId && a.tag_id === tagId ? { ...a, bonus_points: bonus } : a
    ))
  }

  const fragName = (id: number) => fragments.find(f => f.id === id)?.name ?? `#${id}`
  const tagName = (id: string) => tags.find(t => t.id === id)?.title ?? id

  if (loading) return <p>Chargement...</p>

  return (
    <div className="section">
      <h2>Affinites Fragments → Types de lieu</h2>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
        Chaque fragment augmente la limite d'influence a distance sur les lieux du type associe.
      </p>

      <table className="settings-table" style={{ marginBottom: 16 }}>
        <thead>
          <tr>
            <th>Fragment</th>
            <th>Type de lieu</th>
            <th>+ Limite distance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {affinities.map(a => (
            <tr key={`${a.fragment_id}-${a.tag_id}`}>
              <td>{fragName(a.fragment_id)}</td>
              <td>{tagName(a.tag_id)}</td>
              <td>
                <input
                  type="number"
                  min="1"
                  value={a.bonus_points}
                  onChange={e => updateBonus(a.fragment_id, a.tag_id, parseInt(e.target.value) || 1)}
                  className="settings-input"
                  style={{ width: 60 }}
                />
              </td>
              <td>
                <button onClick={() => removeAffinity(a.fragment_id, a.tag_id)} style={{ cursor: 'pointer', border: 'none', background: 'none', color: '#c00' }}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={newFragId} onChange={e => setNewFragId(e.target.value ? parseInt(e.target.value) : '')} className="settings-input" style={{ width: 200 }}>
          <option value="">-- Fragment --</option>
          {fragments.map(f => <option key={f.id} value={f.id}>{f.name}{f.collection ? ` (${f.collection})` : ''}</option>)}
        </select>
        <select value={newTagId} onChange={e => setNewTagId(e.target.value)} className="settings-input" style={{ width: 200 }}>
          <option value="">-- Type de lieu --</option>
          {tags.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <input type="number" min="1" value={newBonus} onChange={e => setNewBonus(parseInt(e.target.value) || 1)} className="settings-input" style={{ width: 60 }} />
        <button onClick={addAffinity} className="btn-primary" disabled={newFragId === '' || !newTagId}>
          Ajouter
        </button>
      </div>

      <SaveBar hasChanges={hasChanges} saving={saving} onSave={handleSave} />
    </div>
  )
}
