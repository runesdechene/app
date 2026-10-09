/**
 * QUOI     — l'analyse du viseur : plusieurs fois par seconde, le carré du viseur passe au modèle,
 *            se classe contre les références, et la règle dit quand biper.
 * POURQUOI — `meilleur` sert de suggestion à la feuille des admins ; `empreinteActuelle` leur donne
 *            la vue à ajouter. `erreur` évite une attente sans fin si le modèle ne se charge pas.
 * ATTENTION — `surBip` est lu par référence : changer de fonction ne relance pas la boucle.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { chargerModele, type Empreinteur } from '../lib/modele'
import { avancer, classer, DEPART, type Place, type Reference } from '../lib/regleDuBip'
import { cadrer } from '../lib/viseur'

const PAS_MS = 120 // une analyse toutes les 120 ms au plus

export function useAnalyse(
  video: RefObject<HTMLVideoElement | null>,
  references: Reference[] | undefined,
  actif: boolean,
  surBip: (fragment: number) => void,
) {
  const [empreinteur, setEmpreinteur] = useState<Empreinteur | null>(null)
  const [erreur, setErreur] = useState(false)
  const [meilleur, setMeilleur] = useState<Place | null>(null)
  const derniere = useRef<number[] | null>(null)
  const rappel = useRef(surBip)
  useEffect(() => {
    rappel.current = surBip
  })

  useEffect(() => {
    let parti = false
    chargerModele()
      .then((e) => {
        if (!parti) setEmpreinteur(() => e)
      })
      .catch(() => {
        if (!parti) setErreur(true)
      })
    return () => {
      parti = true
    }
  }, [])

  useEffect(() => {
    if (!actif || !empreinteur || !references) return
    const toile = document.createElement('canvas')
    let etat = DEPART
    let dernierPas = 0
    let image = 0
    const pas = (maintenant: number) => {
      image = requestAnimationFrame(pas)
      const v = video.current
      if (!v || v.readyState < 2 || maintenant - dernierPas < PAS_MS) return
      dernierPas = maintenant
      const empreinte = empreinteur(cadrer(v, toile))
      derniere.current = empreinte
      const classement = classer(empreinte, references)
      setMeilleur(classement[0] ?? null)
      const suite = avancer(etat, classement, maintenant)
      etat = suite.etat
      if (suite.bip !== null) rappel.current(suite.bip)
    }
    image = requestAnimationFrame(pas)
    return () => {
      cancelAnimationFrame(image)
    }
  }, [actif, empreinteur, references, video])

  return { pret: empreinteur !== null, erreur, meilleur, empreinteActuelle: () => derniere.current }
}
