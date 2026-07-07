import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import type { ModFilter, ModListResult, ModListRow, ModTag } from './types'
import { PlaceRow } from './PlaceRow'
import { PlaceEditPanel } from './PlaceEditPanel'

const PAGE = 50

export function PlacesModeration() {
  const [filter, setFilter] = useState<ModFilter>('unverified')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<ModListRow[]>([])
  const [total, setTotal] = useState(0)
  const [verifiedTotal, setVerifiedTotal] = useState(0)
  const [grandTotal, setGrandTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<ModTag[]>([])

  // Debounce recherche
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('mod_list_places', {
        p_search: debounced || null,
        p_filter: filter,
        p_tag_id: null,
        p_limit: PAGE,
        p_offset: page * PAGE,
      })
      if (!error && data && !(data as { error?: string }).error) {
        const res = data as ModListResult
        setRows(res.rows)
        setTotal(res.total)
      }
    } finally {
      setLoading(false)
    }
  }, [debounced, filter, page])

  // Compteurs de progression (vérifiés / total) — indépendants du filtre courant.
  const fetchCounters = useCallback(async () => {
    const [{ data: all }, { data: ver }] = await Promise.all([
      supabase.rpc('mod_list_places', { p_search: null, p_filter: 'all', p_tag_id: null, p_limit: 1, p_offset: 0 }),
      supabase.rpc('mod_list_places', { p_search: null, p_filter: 'verified', p_tag_id: null, p_limit: 1, p_offset: 0 }),
    ])
    if (all && !(all as { error?: string }).error) setGrandTotal((all as ModListResult).total)
    if (ver && !(ver as { error?: string }).error) setVerifiedTotal((ver as ModListResult).total)
  }, [])

  useEffect(() => { fetchList() }, [fetchList])
  useEffect(() => { fetchCounters() }, [fetchCounters])

  useEffect(() => {
    supabase.from('tags').select('id, title, color, background').order('order')
      .then(({ data }) => {
        if (Array.isArray(data)) {
          setAllTags(data.map(t => ({ ...t, is_primary: false } as ModTag)))
        }
      })
  }, [])

  function refreshAll() { fetchList(); fetchCounters() }

  const pages = Math.max(1, Math.ceil(total / PAGE))
  const pct = grandTotal > 0 ? Math.round((verifiedTotal / grandTotal) * 100) : 0

  return (
    <div className="mod-wrap">
      <div className="mod-head">
        <h1 className="mod-title">Modération des lieux</h1>
        <div className="mod-progress">
          <div className="mod-progress-bar"><div className="mod-progress-fill" style={{ width: `${pct}%` }} /></div>
          <div className="mod-progress-label">{verifiedTotal} / {grandTotal} vérifiés</div>
        </div>
      </div>

      <div className="mod-toolbar">
        {(['unverified', 'verified', 'all'] as ModFilter[]).map(f => (
          <button key={f} className={`mod-pill${filter === f ? ' active' : ''}`}
                  onClick={() => { setFilter(f); setPage(0) }}>
            {f === 'unverified' ? 'À traiter' : f === 'verified' ? 'Vérifiés' : 'Tous'}
          </button>
        ))}
        <input className="mod-search" placeholder="🔍 Rechercher par titre…"
               value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="loading">Chargement...</div> : (
        <>
          {rows.length === 0 && <p className="mod-empty">Aucun lieu.</p>}
          {rows.map(row => (
            <div key={row.id} className={`mod-row${openId === row.id ? ' open' : ''}`}>
              <PlaceRow row={row} open={openId === row.id}
                        onToggle={() => setOpenId(openId === row.id ? null : row.id)} />
              {openId === row.id && (
                <PlaceEditPanel
                  placeId={row.id}
                  currentTags={row.tags}
                  allTags={allTags}
                  onChanged={refreshAll}
                />
              )}
            </div>
          ))}

          <div className="mod-pager">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ Précédent</button>
            <span>page {page + 1} / {pages}</span>
            <button disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Suivant ›</button>
          </div>
        </>
      )}
    </div>
  )
}
