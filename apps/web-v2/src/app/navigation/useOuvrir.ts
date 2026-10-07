/**
 * QUOI     — ouvrir un panneau (« ajouter », « notifications », « titres », « enigmes »…) par-dessus
 *            l'onglet courant.
 * POURQUOI — la coquille et le menu du profil ouvrent les mêmes panneaux de la même façon.
 */
import { useLocation, useNavigate } from 'react-router'
import { disposition } from './disposition'

// Ouvrir un panneau (« ajouter », « notifications »…) par-dessus l'onglet courant. Ce qui est
// déjà ouvert ne s'empile pas une seconde fois dans l'historique. Un panneau prend la place du
// détail ouvert (un lieu…) au lieu de s'empiler dessus : le fermer ramène à l'onglet, sans
// rouvrir le détail d'avant (Uriel, 30/09).
export function useOuvrir() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { actif } = disposition(pathname)
  return (segment: string) => {
    const racine = `/${actif ?? 'carte'}`
    const adresse = `${racine}/${segment}`
    if (pathname !== adresse) void navigate(adresse, { replace: pathname !== racine })
  }
}
