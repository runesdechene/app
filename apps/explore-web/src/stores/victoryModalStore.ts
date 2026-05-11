import { create } from 'zustand'

/**
 * V0.7.6 (8/05) — Store pour la VictoryModal qui s'affiche quand l'utilisateur
 * a pris un lieu par mécénat. Trigger depuis useCourtNotifications, consommé
 * dans MapPage.
 */
export interface VictoryPayload {
  placeTitle: string
  fromVacant: boolean
  factionColor: string | null
  /** V0.8.10 (11/05) — Source du déclenchement, change le wording :
   *  - 'taken_remote' (default) : prise à distance par mécénat (Couronnes)
   *  - 'plant_gps' : étendard planté IRL sur le lieu
   *  - 'reaffirm_gps' : présence réaffirmée IRL (déjà veilleur, défensif) */
  mode?: 'taken_remote' | 'plant_gps' | 'reaffirm_gps'
  /** Gains affichés dans la modale (optionnel — si non fourni, pas de section gains) */
  gloryGain?: number
  coupeGain?: number
  /** Bonus score Cour ajouté au lieu (= plant_flag_solo_bonus + companions, 0 sur reaffirm) */
  courBonus?: number
  /** Nombre de menaces (Cour adverses) effacées — uniquement reaffirm_gps */
  threatsCleared?: number
}

interface VictoryModalStoreState {
  pending: VictoryPayload | null
  show: (payload: VictoryPayload) => void
  dismiss: () => void
}

export const useVictoryModalStore = create<VictoryModalStoreState>((set) => ({
  pending: null,
  show: (payload) => set({ pending: payload }),
  dismiss: () => set({ pending: null }),
}))
