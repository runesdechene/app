import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './EnigmesSignalees.css'

// Les énigmes que les joueurs contestent, envoyées depuis le verdict de la V2 (migration 470).
// Accepter ajoute la réponse du joueur aux réponses acceptées et clôt les signalements qu'elle règle.
// Depuis la 472, on peut signaler avant de répondre, et proposer une bonne réponse : la proposition se
// lit, elle ne s'accepte pas (une réponse attendue fausse se réécrit dans « Modifier l'énigme »).
interface SignalementEnigme {
  id: number
  raison: string
  precision: string | null
  reponseDonnee: string | null
  reponseProposee: string | null
  quand: string
  enigme: { numero: number; question: string; reponse: string; variantes: string[]; format: 'qcm' | 'free' }
  qui: { id: string; nom: string }
}

const RAISONS: Record<string, string> = {
  reponse_refusee: 'Sa réponse aurait dû être acceptée',
  erreur: 'L’énoncé, la réponse ou l’explication est faux',
  autre: 'Autre chose',
}

export function EnigmesSignalees() {
  const [rows, setRows] = useState<SignalementEnigme[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('signalements_enigme_du_hub')
      if (error) throw error
      if (Array.isArray(data)) setRows(data as SignalementEnigme[])
    } catch (e) {
      setErreur(`${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchList() }, [fetchList])

  const traiter = async (s: SignalementEnigme, accepter: boolean) => {
    setBusy(s.id)
    setErreur(null)
    try {
      const { error } = await supabase.rpc('traiter_signalement_enigme', { p_id: s.id, p_accepter: accepter })
      if (error) throw error
      await fetchList()
    } catch (e) {
      setErreur(`${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="section signalees">
      <div className="page-header"><h1>Énigmes signalées</h1></div>
      <p className="signalees-intro">
        Ce que les joueurs contestent après leur réponse. Accepter une réponse vaut pour la suite, pas pour le passé.
      </p>

      {erreur && <p className="signalees-erreur" role="alert">{erreur}</p>}
      {loading && rows.length === 0 && <div className="loading">Chargement…</div>}
      {!loading && rows.length === 0 && !erreur && (
        <p className="signalees-vide">Aucune énigme signalée. Les signalements arrivent ici depuis le verdict d’une énigme.</p>
      )}

      <div className="signalees-liste">
        {rows.map(s => (
          <article key={s.id} className="signalement">
            <p className="signalement-question">
              <span className="signalement-numero">Énigme n° {s.enigme.numero}</span>
              {s.enigme.question}
            </p>

            <div className="signalement-paire">
              <div>
                <span className="signalement-etiquette">Attendue</span>
                <span className="signalement-reponse">{s.enigme.reponse}</span>
                {s.enigme.variantes.length > 0 && (
                  <span className="signalement-variantes">ou {s.enigme.variantes.join(', ')}</span>
                )}
              </div>
              <div>
                <span className="signalement-etiquette">Réponse de {s.qui.nom}</span>
                {s.reponseDonnee !== null ? (
                  <span className="signalement-reponse signalement-reponse--joueur">{s.reponseDonnee}</span>
                ) : (
                  <span className="signalement-pas-repondu">N’a pas encore répondu</span>
                )}
              </div>
            </div>

            {s.reponseProposee && (
              <p className="signalement-proposition">
                Selon {s.qui.nom}, la bonne réponse serait <strong>{s.reponseProposee}</strong>
              </p>
            )}

            <p className="signalement-motif">
              <strong>{RAISONS[s.raison] ?? s.raison}</strong>
              {s.precision && <> — « {s.precision} »</>}
            </p>
            <p className="signalement-quand">
              {new Date(s.quand).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>

            <div className="signalement-actions">
              {s.enigme.format === 'free' && s.reponseDonnee !== null && (
                <button className="btn-primary" onClick={() => traiter(s, true)} disabled={busy === s.id}>
                  Accepter cette réponse
                </button>
              )}
              <Link className="btn-secondary" to={`/carte/enigmes?edit=${s.enigme.numero}`}>
                Modifier l’énigme
              </Link>
              <button className="btn-secondary" onClick={() => traiter(s, false)} disabled={busy === s.id}>
                Clore sans suite
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
