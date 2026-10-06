/**
 * QUOI     — ouvrir l'ajout d'un lieu depuis un pin : le brouillon naît du pin (sa position), puis
 *            le parcours s'ouvre ; si un autre brouillon attend, « Remplacer ton brouillon en
 *            cours ? » d'abord.
 * POURQUOI — un seul brouillon à la fois (IndexedDB) : compléter un pin ne doit jamais effacer en
 *            silence un lieu à moitié écrit (spec pin GPS, écran 5).
 * ATTENTION — le pin arrive en simple forme (`id`, `point`, `poseLe`) : la zone ajout ne connaît
 *            pas la zone pin (règle ESLint). La route fait le lien.
 */
import { useEffect, useRef, useState } from 'react'
import type { Point } from '@/shared/lib/distance'
import { Feuille } from '@/shared/ui/Feuille'
import { brouillonDuPin, chargerBrouillon, enregistrerBrouillon, type Brouillon } from '../lib/brouillon'
import styles from './ParcoursAjout.module.css'

type Pin = { id: string; point: Point; poseLe: Date }

// Un brouillon qu'on perdrait : des photos ou un nom, et né d'autre chose que ce pin.
function enConflit(b: Brouillon | null, pin: Pin): boolean {
  return b !== null && (b.photos.length > 0 || b.nom.trim() !== '') && b.pin?.id !== pin.id
}

// Le brouillon du pin prend la place de l'ancien, puis l'ajout s'ouvre.
async function remplacer(pin: Pin, onOuvrir: () => void) {
  await enregistrerBrouillon(brouillonDuPin(pin))
  onOuvrir()
}

export function DepuisUnPin({ pin, onOuvrir }: { pin: Pin; onOuvrir: () => void }) {
  const [question, setQuestion] = useState(false)
  // Lus une fois, à l'arrivée : le pin ouvert ne change pas pendant que l'écran est là.
  const arrivee = useRef({ pin, onOuvrir })

  useEffect(() => {
    const { pin, onOuvrir } = arrivee.current
    let fini = false
    void chargerBrouillon().then(async (enCours) => {
      if (fini) return
      if (enConflit(enCours, pin)) setQuestion(true)
      else if (enCours?.pin?.id === pin.id) onOuvrir() // déjà le brouillon de ce pin : on le reprend
      else await remplacer(pin, onOuvrir)
    })
    return () => {
      fini = true
    }
  }, [])

  if (!question) return null
  return (
    <Feuille titre="Remplacer ton brouillon en cours ?" onFermer={onOuvrir}>
      <p className={styles.question}>Remplacer ton brouillon en cours ?</p>
      <p className={styles.explication}>
        Un lieu attend déjà d’être fini. Le remplacer l’efface ; le garder te ramène à lui, et ton pin
        t’attendra.
      </p>
      <div className={styles.choix}>
        <button type="button" className={styles.garder} onClick={onOuvrir}>
          Garder mon brouillon
        </button>
        <button
          type="button"
          className={styles.jeter}
          onClick={() => {
            void remplacer(pin, onOuvrir)
          }}
        >
          Remplacer
        </button>
      </div>
    </Feuille>
  )
}
