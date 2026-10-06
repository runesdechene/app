/**
 * QUOI     — « Tes pins », en tête de la feuille du « + » (maquette « Pin GPS — 3 ») : en attente
 *            de réseau d'abord, puis du plus récent ; chacun dit ses jours.
 * POURQUOI — Uriel, 06/10 : chaque pin dit le temps qui lui reste ; un pin périmé se complète
 *            encore, en ajout à distance.
 * ATTENTION — un pin en attente ne s'ouvre pas (compléter demande le réseau), sauf s'il a été
 *            refusé : on l'ouvre alors pour le supprimer.
 */
import chevron from '@/assets/ui/chevron.svg'
import pinGps from '@/assets/ui/pin-gps.svg'
import { dureeRestante } from '@/shared/lib/validitePin'
import type { PinAffiche } from '../hooks/usePins'
import styles from './TesPins.module.css'

function quand(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function heure(d: Date) {
  return d.toLocaleTimeString('fr-FR', { hour: 'numeric', minute: '2-digit' }).replace(':', ' h ')
}

function nom(p: PinAffiche) {
  if (p.enAttente) return `Pin du ${quand(p.poseLe)}, ${heure(p.poseLe)}`
  return p.lieuDit ?? `Pin du ${quand(p.poseLe)}`
}

function etat(p: PinAffiche) {
  if (p.refuse) return 'Refusé : l’heure ou le GPS du téléphone étaient faux · touche pour le supprimer'
  if (p.enAttente) return `En attente de réseau · ${dureeRestante(p.jours)}`
  return `${quand(p.poseLe)} · ${dureeRestante(p.jours)}`
}

export function TesPins({ pins, onOuvrir }: { pins: PinAffiche[]; onOuvrir: (id: string) => void }) {
  if (pins.length === 0) return null
  return (
    <section aria-label="Tes pins">
      <p className={styles.rubrique}>Tes pins</p>
      {pins.map((p) => {
        const ouvrable = !p.enAttente || p.refuse
        return (
          <button
            key={p.id}
            type="button"
            className={styles.pin}
            data-perime={p.jours <= 0 || undefined}
            disabled={!ouvrable}
            onClick={() => {
              onOuvrir(p.id)
            }}
          >
            <span className={styles.vignette}>
              <img src={pinGps} alt="" />
            </span>
            <span className={styles.texte}>
              <span className={styles.nom}>{nom(p)}</span>
              <span
                className={styles.jours}
                data-alerte={p.refuse || (p.jours > 0 && p.jours <= 3) || undefined}
              >
                {etat(p)}
              </span>
            </span>
            {ouvrable && <img className={styles.chevron} src={chevron} alt="" />}
          </button>
        )
      })}
    </section>
  )
}
