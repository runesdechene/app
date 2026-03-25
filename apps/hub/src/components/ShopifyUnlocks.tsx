import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface ShopifyUnlock {
  id: number
  shopify_tag: string
  unlock_type: string
  unlock_ref_id: number
}

interface FragmentOption {
  id: number
  name: string
  icon: string | null
}

export function ShopifyUnlocks() {
  const [unlocks, setUnlocks] = useState<ShopifyUnlock[]>([])
  const [fragments, setFragments] = useState<FragmentOption[]>([])
  const [loading, setLoading] = useState(true)

  const [newTag, setNewTag] = useState('')
  const [newType, setNewType] = useState('fragment')
  const [newRefId, setNewRefId] = useState<number | ''>('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('shopify_unlocks').select('*').order('created_at', { ascending: false }),
      supabase.from('title_fragments').select('id, name, icon').order('name'),
    ]).then(([unlocksRes, fragsRes]) => {
      if (unlocksRes.data) setUnlocks(unlocksRes.data as ShopifyUnlock[])
      if (fragsRes.data) setFragments(fragsRes.data as FragmentOption[])
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  async function handleCreate() {
    const tag = newTag.trim()
    if (!tag || !newRefId) return
    setCreating(true)

    const { data, error } = await supabase
      .from('shopify_unlocks')
      .insert({ shopify_tag: tag, unlock_type: newType, unlock_ref_id: newRefId })
      .select()
      .single()

    if (!error && data) {
      setUnlocks(prev => [data as ShopifyUnlock, ...prev])
      setNewTag('')
      setNewRefId('')
    }
    setCreating(false)
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Supprimer ce mapping ?')) return
    const { error } = await supabase.from('shopify_unlocks').delete().eq('id', id)
    if (!error) setUnlocks(prev => prev.filter(u => u.id !== id))
  }

  function getRefName(type: string, refId: number): string {
    if (type === 'fragment') {
      const f = fragments.find(fr => fr.id === refId)
      return f ? `${f.icon ?? ''} ${f.name}`.trim() : `#${refId}`
    }
    return `#${refId}`
  }

  if (loading) return <div className="loading">Chargement...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Shopify Unlocks</h1>
        <span className="tags-count">{unlocks.length} mappings</span>
      </div>

      <p style={{ fontSize: '0.85rem', opacity: 0.5, marginBottom: '1rem' }}>
        Chaque tag Shopify est relie a un fragment. Quand un client achete un produit avec ce tag, le fragment est debloque automatiquement.
      </p>

      {/* Creation */}
      <div className="shopify-create-row">
        <input
          type="text"
          placeholder="Tag Shopify (ex: col-varegue)"
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          className="faction-create-input"
          style={{ flex: 1 }}
        />
        <select
          value={newType}
          onChange={e => setNewType(e.target.value)}
          className="title-create-select"
        >
          <option value="fragment">Fragment</option>
          <option value="item" disabled>Item (futur)</option>
          <option value="boost" disabled>Boost (futur)</option>
        </select>
        <select
          value={newRefId}
          onChange={e => setNewRefId(parseInt(e.target.value) || '')}
          className="title-create-select"
          style={{ minWidth: 200 }}
        >
          <option value="">-- Fragment --</option>
          {fragments.map(f => (
            <option key={f.id} value={f.id}>{f.icon ?? ''} {f.name}</option>
          ))}
        </select>
        <button
          className="faction-create-btn"
          onClick={handleCreate}
          disabled={creating || !newTag.trim() || !newRefId}
        >
          {creating ? '...' : '+ Creer'}
        </button>
      </div>

      {/* Table */}
      <div className="shopify-table">
        <div className="shopify-table-header">
          <span>Tag Shopify</span>
          <span>Type</span>
          <span>Debloque</span>
          <span></span>
        </div>
        {unlocks.length === 0 && (
          <p style={{ textAlign: 'center', opacity: 0.4, padding: '2rem 0' }}>Aucun mapping</p>
        )}
        {unlocks.map(u => (
          <div key={u.id} className="shopify-table-row">
            <span className="shopify-tag-badge">{u.shopify_tag}</span>
            <span className="shopify-type-badge">{u.unlock_type}</span>
            <span>{getRefName(u.unlock_type, u.unlock_ref_id)}</span>
            <button
              className="fragment-word-delete"
              onClick={() => handleDelete(u.id)}
              title="Supprimer"
            >
              &#10005;
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
