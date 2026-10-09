/**
 * QUOI     — garde une liste de messages collée en bas, comme toute messagerie : à l'ouverture,
 *            quand elle devient visible, à chaque nouveau message.
 * POURQUOI — l'écran Messages reste monté derrière les autres onglets : descendre pendant qu'il
 *            est caché ne sert à rien (sa hauteur est nulle), et en arrivant on tombait sur les
 *            plus anciens messages (Uriel, 29/09). Une liste qui apparaît va donc toujours en
 *            bas ; ensuite, un message qui arrive la ramène en bas — sauf si l'on est remonté
 *            lire : alors on ne tire personne vers le bas.
 *            Chrome, en affichant la liste, envoie un défilement « en haut » avant qu'on la
 *            mesure : c'est pourquoi l'apparition décide seule, sans écouter ce défilement.
 * ATTENTION — le hook rend une ref à poser sur la liste qui défile (`<ol ref={coller}>`).
 */
import { useEffect, useState } from 'react'

// En deçà, on est « en bas » : un reste d'arrondi ou un demi-message ne compte pas.
const SEUIL_PX = 40

export function useColleEnBas(): (liste: HTMLElement | null) => void {
  const [liste, setListe] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!liste) return
    let enBas = true
    let hauteur = 0

    function descendre() {
      if (enBas && liste) liste.scrollTop = liste.scrollHeight
    }
    // La liste change de taille : si elle vient d'apparaître (0, puis une hauteur), en bas.
    function redimensionne() {
      if (!liste) return
      if (hauteur === 0 && liste.clientHeight > 0) enBas = true
      hauteur = liste.clientHeight
      descendre()
    }
    function suivre() {
      if (liste) enBas = liste.scrollHeight - liste.scrollTop - liste.clientHeight < SEUIL_PX
    }

    // Un ResizeObserver prévient dès qu'il commence à observer : c'est la descente d'ouverture.
    const taille = new ResizeObserver(redimensionne)
    taille.observe(liste)
    const contenu = new MutationObserver(descendre)
    contenu.observe(liste, { childList: true, subtree: true })
    liste.addEventListener('scroll', suivre)

    return () => {
      taille.disconnect()
      contenu.disconnect()
      liste.removeEventListener('scroll', suivre)
    }
  }, [liste])

  return setListe
}
