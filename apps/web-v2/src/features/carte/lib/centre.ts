/**
 * QUOI     — lit `?centre=lat,lng[,zoom]` dans l'adresse de la carte : où voler, et de combien zoomer.
 * POURQUOI — « Trouver sur la carte » (fiche d'un lieu) y vole au zoom d'un lieu ; « Les chercher sur
 *            la carte » (page « Les énigmes », 07/10) au zoom des sceaux, sur la zone d'une culture.
 *            Une adresse mal écrite ne vole nulle part.
 */
const ZOOM_D_UN_LIEU = 14

export function lireCentre(param: string | null): { lat: number; lng: number; zoom: number } | null {
  if (!param) return null
  const nombres = param.split(',').map(Number)
  if (nombres.length < 2 || nombres.length > 3 || !nombres.every(Number.isFinite)) return null
  const [lat = 0, lng = 0, zoom = ZOOM_D_UN_LIEU] = nombres
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng, zoom }
}
