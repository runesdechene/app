import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Les signalements ouverts, envoyés depuis la fiche d'un lieu de la V2 (migration 387).
interface Signalement {
  id: number
  raison: string
  precision: string | null
  quand: string
  lieu: { id: string; nom: string; masque: boolean }
  qui: { id: string; nom: string }
}

const RAISONS: Record<string, string> = {
  n_existe_pas: "N'existe pas",
  prive_ou_dangereux: 'Privé ou dangereux',
  doublon: 'Doublon',
  contenu: 'Contenu inapproprié',
  autre: 'Autre',
}

const APP = 'https://app.runesdechene.com/v2/carte/lieu/'

export function Signalements() {
  const [rows, setRows] = useState<Signalement[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase.rpc('mod_signalements')
      if (Array.isArray(data)) setRows(data as Signalement[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchList() }, [fetchList])

  const agir = async (id: number, action: () => PromiseLike<unknown>) => {
    setBusy(id)
    try {
      await action()
      await fetchList()
    } finally {
      setBusy(null)
    }
  }

  const masquer = (s: Signalement) =>
    agir(s.id, () => supabase.rpc('mod_set_masked', { p_place_id: s.lieu.id, p_masked: true }))

  const traiter = (s: Signalement) =>
    agir(s.id, () => supabase.rpc('mod_traiter_signalement', { p_id: s.id }))

  return (
    <div className="mod-wrap">
      <div className="mod-head">
        <h1 className="mod-title">Signalements</h1>
      </div>

      {loading && rows.length === 0 && <div className="loading">Chargement…</div>}
      {!loading && rows.length === 0 && <div className="empty">Aucun signalement en attente.</div>}

      {rows.map(s => (
        <div key={s.id} className="mod-row">
          <div className="mod-row-main" style={{ gridTemplateColumns: '1fr auto', cursor: 'default' }}>
            <div>
              <div style={{ fontWeight: 600 }}>
                <a href={APP + s.lieu.id} target="_blank" rel="noreferrer">{s.lieu.nom}</a>
                {s.lieu.masque && <span className="mod-flag" style={{ marginLeft: 8 }}>masqué</span>}
              </div>
              <div className="mod-badges">
                <span className="mod-badge" style={{ background: '#f3d9c9', color: '#8a3b1f' }}>
                  {RAISONS[s.raison] ?? s.raison}
                </span>
              </div>
              {s.precision && <div style={{ fontSize: 14, margin: '4px 0' }}>« {s.precision} »</div>}
              <div className="mod-meta">
                <span>par {s.qui.nom}</span>
                <span>{new Date(s.quand).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!s.lieu.masque && (
                <button className="mod-btn mask" onClick={() => masquer(s)} disabled={busy === s.id}>
                  Masquer le lieu
                </button>
              )}
              <button className="mod-btn" onClick={() => traiter(s)} disabled={busy === s.id}>
                Traité
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
