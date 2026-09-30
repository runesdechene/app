import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Les mises à jour de l'app (migration 397) : elles arrivent dans la cloche de la V2, sous
// « Nouveautés d'Explore ». Écrites pour les joueurs : jamais de détail technique.
interface MiseAJour {
  id: number
  titre: string
  texte: string
  quand: string
}

const AIDE = `Un paragraphe par bloc, séparés par une ligne vide.
Une ligne qui commence par « - » devient un point de liste ; ce qui précède « : » s'écrit en gras.`

export function MisesAJour() {
  const [rows, setRows] = useState<MiseAJour[]>([])
  const [loading, setLoading] = useState(true)
  const [titre, setTitre] = useState('')
  const [texte, setTexte] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase.rpc('mises_a_jour_publiees')
      if (Array.isArray(data)) setRows(data as MiseAJour[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchList() }, [fetchList])

  const publier = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const { error } = await supabase.rpc('publier_mise_a_jour', { p_titre: titre, p_texte: texte })
      if (error) {
        setMsg(error.message)
        return
      }
      setTitre('')
      setTexte('')
      setMsg('Publiée : elle est dans la cloche de chacun.')
      await fetchList()
    } finally {
      setBusy(false)
    }
  }

  const supprimer = async (m: MiseAJour) => {
    if (!window.confirm(`Supprimer « ${m.titre} » ?`)) return
    setBusy(true)
    try {
      await supabase.rpc('supprimer_mise_a_jour', { p_id: m.id })
      await fetchList()
    } finally {
      setBusy(false)
    }
  }

  const pret = titre.trim().length > 0 && titre.trim().length <= 80
    && texte.trim().length > 0 && texte.trim().length <= 3000

  return (
    <div className="mod-wrap" style={{ maxWidth: 760 }}>
      <div className="mod-head">
        <h1 className="mod-title">Mises à jour</h1>
      </div>

      <div className="mod-row" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <input
          className="mod-search"
          placeholder="Titre (ex. Filtrer la carte)"
          maxLength={80}
          value={titre}
          onChange={e => setTitre(e.target.value)}
        />
        <textarea
          className="mod-search mod-textarea"
          placeholder={AIDE}
          value={texte}
          onChange={e => setTexte(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="mod-btn" onClick={publier} disabled={!pret || busy}>
            Publier
          </button>
          <span className="mod-meta">{texte.trim().length} / 3000</span>
          {msg && <span className="mod-meta">{msg}</span>}
        </div>
      </div>

      <h2 style={{ fontSize: 16, margin: '24px 0 10px' }}>Déjà publiées</h2>
      {loading && rows.length === 0 && <div className="loading">Chargement…</div>}
      {!loading && rows.length === 0 && <div className="empty">Aucune mise à jour publiée.</div>}
      {rows.map(m => (
        <div key={m.id} className="mod-row" style={{ padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{m.titre}</div>
              <div className="mod-meta">
                {new Date(m.quand).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
              </div>
            </div>
            <button className="mod-btn mask" onClick={() => supprimer(m)} disabled={busy}>
              Supprimer
            </button>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, marginTop: 8 }}>{m.texte}</div>
        </div>
      ))}
    </div>
  )
}
