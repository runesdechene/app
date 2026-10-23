/**
 * QUOI     — photographie les titres en Bebas de la lettre, tels que l'éditeur les affiche, pour l'envoi.
 * POURQUOI — Gmail et Outlook ignorent les polices web : Bebas y devenait Arial (essai du 23/10, « très moche »).
 *            Chaque titre marqué `data-titre` (@runes/missives, EnImage) part donc en image, avec la vraie police,
 *            la couleur et les retours à la ligne de l'écran ; l'e-mail garde son texte en description.
 */
import type { TitreEnImage } from '@runes/missives'
import { getFontEmbedCSS, toBlob } from 'html-to-image'

type Capturer = (element: HTMLElement) => Promise<Blob | null>

export async function photographierTitres(
  racine: HTMLElement,
  deposer: (image: Blob) => Promise<string>,
  capturer?: Capturer,
): Promise<Record<string, TitreEnImage>> {
  const elements = [...racine.querySelectorAll<HTMLElement>('[data-titre]')]
  // Les polices se lisent une fois pour toute la lettre, pas une fois par titre.
  const prendre = capturer ?? (await capturerAvecPolices(racine))
  const titres: Record<string, TitreEnImage> = {}
  for (const element of elements) {
    const zone = element.dataset.titre
    const image = await prendre(element)
    if (!zone || !image) continue
    titres[zone] = { src: await deposer(image), largeur: Math.ceil(element.offsetWidth), hauteur: Math.ceil(element.offsetHeight) }
  }
  return titres
}

async function capturerAvecPolices(racine: HTMLElement): Promise<Capturer> {
  const fontEmbedCSS = await getFontEmbedCSS(racine)
  // Deux fois la taille affichée : net sur les écrans fins.
  return (element) => toBlob(element, { pixelRatio: 2, fontEmbedCSS })
}
