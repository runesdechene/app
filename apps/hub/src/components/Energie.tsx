import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CLES, DEFAUTS, erreurReglages, resume, type ReglagesEnergie } from '../lib/reglagesEnergie'
import { SaveBar } from './SaveBar'
import './Energie.css'

// L'énergie de la V2 (migration 399) : la taille de la jauge, sa recharge, et le prix d'une
// découverte selon la distance. La V1 suit la même jauge.
export function Energie() {
  const [reglages, setReglages] = useState<ReglagesEnergie>(DEFAUTS)
  const [enregistres, setEnregistres] = useState<ReglagesEnergie>(DEFAUTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', Object.values(CLES))
      if (error) throw error
      const lus: ReglagesEnergie = { ...DEFAUTS }
      for (const champ of Object.keys(CLES) as (keyof ReglagesEnergie)[]) {
        const ligne = (data as { key: string; value: string }[]).find(l => l.key === CLES[champ])
        if (!ligne) continue
        const n = Number(ligne.value)
        lus[champ] = champ === 'minutesParPoint' ? Math.round(n / 60) : n
      }
      setReglages(JSON.parse(JSON.stringify(lus)))
      setEnregistres(JSON.parse(JSON.stringify(lus)))
    } catch (e) {
      setSaveError(`Lecture impossible : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const erreur = erreurReglages(reglages)
  const hasChanges = JSON.stringify(reglages) !== JSON.stringify(enregistres)

  const changer = (champ: keyof ReglagesEnergie) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaveError(null)
    setReglages(r => ({ ...r, [champ]: e.target.value === '' ? NaN : Number(e.target.value) }))
  }

  const handleSave = async () => {
    if (erreur) return
    setSaving(true)
    setSaveError(null)
    try {
      // Tout d'un coup : un enregistrement à moitié laisserait des paliers dans le désordre.
      const lignes = (Object.keys(CLES) as (keyof ReglagesEnergie)[]).map(champ => ({
        key: CLES[champ],
        value: String(champ === 'minutesParPoint' ? reglages[champ] * 60 : reglages[champ]),
      }))
      const { error } = await supabase.from('app_settings').upsert(lignes, { onConflict: 'key' })
      if (error) {
        setSaveError(error.message)
        return
      }
      await fetchAll()
    } catch (e) {
      setSaveError(`${e}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="section"><p>Chargement…</p></div>

  const champ = (c: keyof ReglagesEnergie, libelle: string, unite: string) => (
    <label className="energie-champ">
      <span className="energie-champ-libelle">{libelle}</span>
      <span className="energie-champ-saisie">
        <input type="number" min="0" step="1" value={Number.isNaN(reglages[c]) ? '' : reglages[c]} onChange={changer(c)} />
        <span className="energie-champ-unite">{unite}</span>
      </span>
    </label>
  )

  const segments = [
    { cout: 0, de: 0, a: reglages.gratuitKm },
    { cout: reglages.cout1, de: reglages.gratuitKm, a: reglages.palier1Km },
    { cout: reglages.cout2, de: reglages.palier1Km, a: reglages.palier2Km },
    { cout: reglages.cout3, de: reglages.palier2Km, a: null },
  ]

  return (
    <div className="section energie">
      <h1>Énergie</h1>
      <p className="energie-resume">{erreur ?? resume(reglages)}</p>

      <section className="energie-carte">
        <h2>La jauge</h2>
        <div className="energie-ligne">
          {champ('maxSansFragment', 'Points sans Fragment', 'points')}
          {champ('minutesParPoint', 'Un point revient en', 'min')}
        </div>
        <div className="energie-points" aria-hidden="true">
          {Array.from({ length: Math.min(30, Math.max(0, reglages.maxSansFragment || 0)) }, (_, i) => (
            <span key={i} className="energie-point" />
          ))}
          <span className="energie-point energie-point--fragment" title="+1 par Fragment" />
        </div>
        <p className="energie-note">Chaque Fragment possédé ajoute un point (en pointillé).</p>
      </section>

      <section className="energie-carte">
        <h2>Le prix de la distance</h2>
        <div className="energie-regle" aria-hidden="true">
          {segments.map((s, i) => (
            <div key={i} className={`energie-segment${s.cout === 0 ? ' energie-segment--gratuit' : ''}`} data-cout={s.cout}>
              <span className="energie-segment-prix">{s.cout === 0 ? 'Gratuit' : `${s.cout} pt${s.cout > 1 ? 's' : ''}`}</span>
              <span className="energie-segment-km">{s.a === null ? `au-delà de ${s.de} km` : `jusqu'à ${s.a} km`}</span>
            </div>
          ))}
        </div>
        <div className="energie-ligne">
          {champ('gratuitKm', 'Zone gratuite', 'km')}
          {champ('palier1Km', 'Palier 1', 'km')}
          {champ('palier2Km', 'Palier 2', 'km')}
        </div>
        <div className="energie-ligne">
          {champ('cout1', 'Jusqu’au palier 1', 'points')}
          {champ('cout2', 'Jusqu’au palier 2', 'points')}
          {champ('cout3', 'Au-delà', 'points')}
        </div>
        <p className="energie-note">Sans position, un lieu coûte le prix « Au-delà ».</p>
      </section>

      <SaveBar
        hasChanges={hasChanges}
        saving={saving}
        error={saveError ?? (hasChanges ? erreur : null)}
        onSave={handleSave}
        onCancel={() => {
          setSaveError(null)
          setReglages(JSON.parse(JSON.stringify(enregistres)))
        }}
      />
    </div>
  )
}
