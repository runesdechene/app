/**
 * QUOI     — le bloc « Scan » d'un Fragment dans le Hub : ses empreintes d'illustration (et
 *            « Recalculer »), ses vues apprises (chacune retirable), « à filmer » s'il n'en a aucune,
 *            ses scans sur 7 et 30 jours.
 * POURQUOI — spec 2026-10-09-v2-scan, « Le Hub ». Les vues s'ajoutent depuis le scanner d'Explore.
 */
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { recalculerIllustrations } from '../../lib/empreintesScan'
import './ScanDuFragment.css'

export interface ScanDUnFragment {
  id: number
  illustrations: number
  vues: { id: number; le: string; par: string | null }[]
  scans7: number
  scans30: number
}

interface Props {
  fragment: { id: number; visible: boolean; illustration_url: string | null; illustration_sombre_url: string | null }
  scan: ScanDUnFragment | undefined
  onChange: () => void
}

const date = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function ScanDuFragment({ fragment, scan, onChange }: Props) {
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function agir(action: () => Promise<unknown>) {
    setOccupe(true)
    setErreur(null)
    try {
      await action()
      onChange()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : JSON.stringify(e))
    } finally {
      setOccupe(false)
    }
  }

  const vues = scan?.vues ?? []
  return (
    <section className="scan-fragment">
      <h3>Scan</h3>
      <p>
        {scan?.illustrations ?? 0} empreintes d’illustration ·{' '}
        <button className="btn-secondary" disabled={occupe} onClick={() => void agir(() => recalculerIllustrations(fragment))}>
          {occupe ? 'Calcul…' : 'Recalculer'}
        </button>
      </p>
      {fragment.visible && vues.length === 0 && (
        <p className="scan-a-filmer">À filmer : aucune vue du vrai t-shirt (depuis le scanner d’Explore, en admin).</p>
      )}
      {vues.length > 0 && (
        <ul className="scan-vues">
          {vues.map((v) => (
            <li key={v.id}>
              Vue du {date(v.le)}{v.par ? ` · ${v.par}` : ''}{' '}
              <button className="btn-secondary" disabled={occupe} onClick={() => void agir(async () => {
                const { error } = await supabase.rpc('retirer_empreinte', { p_id: v.id })
                if (error) throw error
              })}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="scan-chiffres">Scans : {scan?.scans7 ?? 0} en 7 jours · {scan?.scans30 ?? 0} en 30 jours</p>
      {erreur && <p className="scan-erreur">{erreur}</p>}
    </section>
  )
}
