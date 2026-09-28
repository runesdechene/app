/**
 * QUOI     — le nom à inscrire sur la carte : le territoire de près, le pays de plus loin,
 *            rien au-dessus de la mer ou de très haut.
 * POURQUOI — le centre est arrondi au centième de degré (~1 km) : quelques mètres de
 *            glissement ne relancent aucune requête, le cache répond.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchTerritoire } from '../api/carte'

const ZOOM_TERRITOIRE = 8
const ZOOM_PAYS = 5

const arrondir = (x: number) => Math.round(x * 100) / 100

export function useTerritoire(centre: { lat: number; lng: number; zoom: number } | null): string | null {
  const lat = centre ? arrondir(centre.lat) : 0
  const lng = centre ? arrondir(centre.lng) : 0
  const visible = centre !== null && centre.zoom >= ZOOM_PAYS
  const query = useQuery({
    queryKey: ['carte', 'territoire', lat, lng],
    queryFn: () => fetchTerritoire(lat, lng),
    enabled: visible,
    staleTime: Infinity,
  })
  if (!visible || !query.data) return null
  return centre.zoom >= ZOOM_TERRITOIRE ? query.data.territoire : query.data.pays
}
