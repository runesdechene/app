import { create } from 'zustand'

/**
 * V0.7.7 (10/05) — micro-store pour piloter l'ouverture manuelle de
 * GeolocationPrompt depuis ProfileMenu (bouton "Activer ma position").
 * Au-delà de l'auto-affichage au mount (état === 'prompt'), permet de
 * rouvrir la modale même si l'utilisateur a refusé une fois ou cliqué
 * "Plus tard".
 */
interface State {
  forceOpen: boolean
  open: () => void
  close: () => void
}

export const useGeolocPromptStore = create<State>((set) => ({
  forceOpen: false,
  open: () => set({ forceOpen: true }),
  close: () => set({ forceOpen: false }),
}))
