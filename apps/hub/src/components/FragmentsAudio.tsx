import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface FragmentAudioStat {
  illustration_handle: string
  ecoutes: number
  completions: number
  taux: number | null
  ecoutes_motif: number
  ecoutes_produit: number
  derniere_ecoute: string | null
}

export function FragmentsAudio() {
  const [stats, setStats] = useState<FragmentAudioStat[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    async function charger() {
      const { data, error } = await supabase.rpc('get_fragment_audio_stats')
      if (!vivant) return
      if (error) {
        setErreur(error.message)
      } else {
        setStats((data ?? []) as FragmentAudioStat[])
      }
      setLoading(false)
    }
    void charger()
    return () => { vivant = false }
  }, [])

  if (loading) return <div className="page">Chargement…</div>
  if (erreur) return <div className="page">Erreur de chargement : {erreur}</div>

  const totalEcoutes = stats.reduce((n, s) => n + s.ecoutes, 0)
  const totalCompletions = stats.reduce((n, s) => n + s.completions, 0)
  const tauxGlobal = totalEcoutes > 0
    ? Math.round((1000 * totalCompletions) / totalEcoutes) / 10
    : null

  return (
    <div className="page">
      <h1>Fragments audio</h1>
      <p>
        Le taux de complétion est la colonne qui décide : c&apos;est lui qui dit si la voix off
        mérite de rester au budget de chaque drop. Les écoutes de moins de dix secondes ne sont
        pas comptées.
      </p>

      {stats.length === 0 ? (
        <p>Aucune écoute enregistrée pour l&apos;instant.</p>
      ) : (
        <>
          <p>
            <strong>{totalEcoutes}</strong> écoutes, <strong>{totalCompletions}</strong> allées au
            bout{tauxGlobal !== null ? <> — <strong>{tauxGlobal} %</strong> de complétion</> : null}
          </p>
          <table>
            <thead>
              <tr>
                <th>Fragment</th>
                <th>Écoutes</th>
                <th>Complétions</th>
                <th>Taux</th>
                <th>Page motif</th>
                <th>Fiche produit</th>
                <th>Dernière écoute</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.illustration_handle}>
                  <td>{s.illustration_handle}</td>
                  <td>{s.ecoutes}</td>
                  <td>{s.completions}</td>
                  <td>{s.taux !== null ? `${s.taux} %` : '—'}</td>
                  <td>{s.ecoutes_motif}</td>
                  <td>{s.ecoutes_produit}</td>
                  <td>
                    {s.derniere_ecoute
                      ? new Date(s.derniere_ecoute).toLocaleDateString('fr-FR')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
