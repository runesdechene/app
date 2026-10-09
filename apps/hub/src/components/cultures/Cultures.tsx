/**
 * QUOI     — les cultures des énigmes : nom, icône, couleur, complément de titre, active, et leur zone
 *            (autant de cercles qu'on veut, tirés à égalité) sur une carte, avec les « ? » éveillés.
 * POURQUOI — spec énigmes (2026-10-07) : la zone et l'icône de chaque culture se règlent ici ; les
 *            titres (« Sage des arcanes scandinaves ») se renomment quand le complément change.
 * ATTENTION — écriture par la RPC `enregistrer_culture` (réservée aux admins) : la table n'a pas de
 *            policy d'écriture. Motif SaveBar + refetch après chaque save (`.claude/rules/hub.md`).
 */
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Cercle } from '../../lib/cercles'
import { SaveBar } from '../SaveBar'
import { CarteCercles } from './CarteCercles'
import './Cultures.css'

interface Culture {
  id: string
  label: string
  couleur: string | null
  icone: string | null
  complement: string | null
  zone: string | null
  presentation: string | null // le portrait de la culture, en tête de sa page « Les énigmes » (mig 450)
  cercles: Cercle[]
  active: boolean
  ordre: number
  stock: number
  total: number
  eveils: { lat: number; lng: number }[]
}

export function Cultures() {
  const [cultures, setCultures] = useState<Culture[]>([])
  const [enregistrees, setEnregistrees] = useState<Culture[]>([])
  const [choisie, setChoisie] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fichier = useRef<HTMLInputElement>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('cultures_du_hub')
      if (error) throw error
      const lues = (data ?? []) as Culture[]
      setCultures(JSON.parse(JSON.stringify(lues)))
      setEnregistrees(JSON.parse(JSON.stringify(lues)))
      setChoisie((c) => c ?? lues[0]?.id ?? null)
    } catch (e) {
      setSaveError(`${e}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [])

  const culture = cultures.find((c) => c.id === choisie) ?? null
  const changer = (patch: Partial<Culture>) => {
    setCultures((prev) => prev.map((c) => (c.id === choisie ? { ...c, ...patch } : c)))
  }
  const modifiees = cultures.filter((c) => JSON.stringify(c) !== JSON.stringify(enregistrees.find((e) => e.id === c.id)))

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      for (const c of modifiees) {
        const { error } = await supabase.rpc('enregistrer_culture', {
          p_id: c.id, p_label: c.label, p_couleur: c.couleur ?? '', p_icone: c.icone ?? '',
          p_complement: c.complement ?? '', p_cercles: c.cercles, p_active: c.active, p_ordre: c.ordre,
          p_zone: c.zone ?? '', p_presentation: c.presentation ?? '',
        })
        if (error) throw error
      }
      await fetchData()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : `${JSON.stringify(e)}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !culture) return
    setUploading(true)
    try {
      const ext = f.name.split('.').pop() || 'svg'
      const chemin = `cultures/${culture.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('tag-icons').upload(chemin, f, { contentType: f.type })
      if (error) throw error
      changer({ icone: supabase.storage.from('tag-icons').getPublicUrl(chemin).data.publicUrl })
    } catch (err) {
      setSaveError(`Icône : ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUploading(false)
    }
  }

  if (loading && cultures.length === 0) return <div className="loading">Chargement…</div>

  return (
    <div className="section cultures">
      <div className="page-header"><h1>Cultures des énigmes</h1></div>
      <div className="cultures-liste">
        {cultures.map((c) => (
          <button key={c.id} className={c.id === choisie ? 'btn-primary' : 'btn-secondary'} onClick={() => setChoisie(c.id)}>
            {c.label}{c.active ? '' : ' (inactive)'}
          </button>
        ))}
      </div>
      {culture && (
        <div className="cultures-fiche">
          <div className="cultures-champs">
            <label className="faction-field"><span className="faction-field-label">Nom</span>
              <input className="settings-input" value={culture.label} onChange={(e) => changer({ label: e.target.value })} /></label>
            <label className="faction-field"><span className="faction-field-label">Complément de titre (« Sage … »)</span>
              <input className="settings-input" value={culture.complement ?? ''} placeholder="des arcanes scandinaves" onChange={(e) => changer({ complement: e.target.value })} /></label>
            <label className="faction-field"><span className="faction-field-label">Où elle s’éveille (une phrase, page « Les énigmes »)</span>
              <input className="settings-input" value={culture.zone ?? ''} placeholder="entre la Thrace et l’Asie Mineure" onChange={(e) => changer({ zone: e.target.value })} /></label>
            <label className="faction-field"><span className="faction-field-label">En quelques mots (le portrait en tête de sa page « Les énigmes » — jamais la réponse d’une énigme)</span>
              <textarea className="settings-input cultures-portrait" rows={4} value={culture.presentation ?? ''} placeholder="Pendant mille ans…" onChange={(e) => changer({ presentation: e.target.value })} /></label>
            <label className="faction-field"><span className="faction-field-label">Couleur</span>
              <input type="color" value={culture.couleur ?? '#a94842'} onChange={(e) => changer({ couleur: e.target.value })} /></label>
            <div className="faction-field"><span className="faction-field-label">Icône</span>
              {/* L'aperçu tel que l'app la peint : la forme de l'icône, remplie de la couleur de la culture. */}
              {culture.icone && (
                <span
                  className="cultures-icone"
                  style={{ backgroundColor: culture.couleur ?? '#a94842', maskImage: `url("${culture.icone}")` }}
                />
              )}
              <button className="btn-secondary" disabled={uploading} onClick={() => fichier.current?.click()}>{uploading ? 'Envoi…' : 'Choisir une image'}</button>
              <input ref={fichier} type="file" accept="image/svg+xml,image/png,image/webp" hidden onChange={handleUpload} /></div>
            <label className="faction-field"><input type="checkbox" checked={culture.active} onChange={(e) => changer({ active: e.target.checked })} /> Active</label>
            <p className="cultures-stats">{culture.stock} énigmes dans le stock · {culture.total} points au total · {culture.eveils.length} « ? » éveillés</p>
            <div className="cultures-cercles">
              <span className="faction-field-label">Zone : {culture.cercles.length} cercle{culture.cercles.length > 1 ? 's' : ''}, chacun tiré à égalité — un clic sur la carte en pose un (5 km ≈ un site précis)</span>
              {culture.cercles.map((c, i) => (
                <div key={i} className="cultures-cercle">
                  <span>{c.lat.toFixed(2)}, {c.lng.toFixed(2)}</span>
                  <input type="range" min={5} max={1000} step={5} value={c.rayon_km}
                    onChange={(e) => changer({ cercles: culture.cercles.map((x, j) => (j === i ? { ...x, rayon_km: Number(e.target.value) } : x)) })} />
                  <span>{c.rayon_km} km</span>
                  <button className="btn-danger" onClick={() => changer({ cercles: culture.cercles.filter((_, j) => j !== i) })}>Retirer</button>
                </div>
              ))}
            </div>
          </div>
          <CarteCercles
            cercles={culture.cercles}
            eveils={culture.eveils}
            couleur={culture.couleur ?? '#a94842'}
            onPoser={(lat, lng) => {
              changer({ cercles: [...culture.cercles, { lat, lng, rayon_km: 50 }] })
            }}
          />
        </div>
      )}
      <SaveBar hasChanges={modifiees.length > 0} saving={saving} error={saveError}
        onSave={() => void handleSave()} onCancel={() => setCultures(JSON.parse(JSON.stringify(enregistrees)))} />
    </div>
  )
}
