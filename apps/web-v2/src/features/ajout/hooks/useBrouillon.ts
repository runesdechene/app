/**
 * QUOI     — le brouillon du lieu en cours d'ajout : chargé une fois, enregistré après chaque
 *            geste, jetable.
 * POURQUOI — « save le brouillon à tout moment » (Uriel, 29/09) : on n'appuie jamais sur
 *            « enregistrer ». Le compteur `enregistre` avance à chaque enregistrement réussi ; l'en-
 *            tête s'en sert pour dire « ✓ Brouillon enregistré ». Rien ne s'écrit tant qu'on n'a
 *            rien touché : ouvrir puis refermer ne laisse pas un brouillon vide derrière soi.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BROUILLON_VIDE,
  chargerBrouillon,
  enregistrerBrouillon,
  jeterBrouillon,
  type Brouillon,
} from '../lib/brouillon'

// Le temps de laisser finir une frappe : on n'écrit pas à chaque lettre.
const ATTENTE_MS = 300

export function useBrouillon() {
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null)
  const [touche, setTouche] = useState(false)
  const [enregistre, setEnregistre] = useState(0)
  const vivant = useRef(true)

  useEffect(() => {
    vivant.current = true
    void chargerBrouillon().then((b) => {
      if (vivant.current) setBrouillon(b ?? BROUILLON_VIDE)
    })
    return () => {
      vivant.current = false
    }
  }, [])

  useEffect(() => {
    if (!brouillon || !touche) return
    const minuteur = setTimeout(() => {
      enregistrerBrouillon(brouillon)
        .then(() => {
          if (vivant.current) setEnregistre((n) => n + 1)
        })
        .catch(() => undefined) // stockage refusé : on continue sans filet, rien ne casse
    }, ATTENTE_MS)
    return () => {
      clearTimeout(minuteur)
    }
  }, [brouillon, touche])

  const changer = useCallback((modif: Partial<Brouillon>) => {
    setTouche(true)
    setBrouillon((b) => (b ? { ...b, ...modif } : b))
  }, [])

  const jeter = useCallback(async () => {
    setTouche(false)
    await jeterBrouillon()
    setBrouillon(BROUILLON_VIDE)
  }, [])

  return { brouillon, changer, jeter, enregistre }
}
