/**
 * QUOI     — l'adresse d'une image à la taille où on l'affiche : Supabase la redimensionne à la
 *            volée (`/render/image/`), au double de la largeur affichée (écrans nets).
 * POURQUOI — l'app chargeait les originaux : une bannière de 5 Mo pour une bande de 370 px, des
 *            avatars de 400 px pour 22 px (mesure du 01/10/2026 : 11 Mo d'images à l'ouverture).
 *            Une image de Shopify (les Fragments) passe par son CDN, qui redimensionne avec `width=`.
 *            Une image d'ailleurs (blob d'un envoi, autre site) reste telle quelle.
 *            Une photo de lieu, elle, est déjà réduite à l'envoi (1920 px + `_thumb.webp` de 400 px) :
 *            on sert l'une ou l'autre telle quelle. Supabase facture chaque image redimensionnée, et
 *            les 9 000 photos de lieux ont fait exploser le quota (23/10/2026).
 * ATTENTION — `resize=contain` : avec la seule largeur, Supabase garde la hauteur d'origine et
 *            recadre (avatars zoomés, Fragments coupés — 01/10/2026).
 */
const OBJET = '/storage/v1/object/public/'
const RENDU = '/storage/v1/render/image/public/'
const SHOPIFY = 'https://cdn.shopify.com/'
const LARGEUR_MAX = 2000
// Les dossiers où chaque photo `.webp` a sa vignette à côté (garanti par ajouter_lieu et le rattrapage du 23/10).
const PHOTO_DE_LIEU = /\/place-images\/(places|rapatrie)\/.+\.webp$/
// La vignette fait 400 px : nette jusqu'à 300 px affichés, même sur un écran dense.
const LARGEUR_VIGNETTE = 300

export function aLaTaille<T extends string | null>(url: T, largeurAffichee: number): T {
  if (url === null) return url
  const largeur = Math.min(LARGEUR_MAX, Math.round(largeurAffichee * 2))
  const separateur = url.includes('?') ? '&' : '?'
  if (url.startsWith(SHOPIFY)) return `${url}${separateur}width=${String(largeur)}` as T
  if (!url.includes(OBJET)) return url
  if (PHOTO_DE_LIEU.test(url)) {
    return (largeurAffichee <= LARGEUR_VIGNETTE ? url.replace(/(_thumb)?\.webp$/, '_thumb.webp') : url) as T
  }
  return `${url.replace(OBJET, RENDU)}${separateur}width=${String(largeur)}&quality=70&resize=contain` as T
}
