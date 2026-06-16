// Décide quels boutons d'action afficher dans La Cour selon l'état du lieu.
// Règle clé : le bouton « Soutenir un attaquant » n'apparaît que sur un lieu
// veillé ayant au moins un challenger (sinon il n'y a personne à soutenir).

export interface CourtActionsVisibility {
  /** « Soutenir {veilleur} » — uniquement si le lieu est veillé. */
  showSupport: boolean
  /** « Prendre le lieu pour moi » (veillé) ou « Poser ma marque » (vierge) — toujours. */
  showContest: boolean
  /** « Soutenir un attaquant (N) » — veillé ET au moins un challenger. */
  showAttackers: boolean
}

export function getCourtActionsVisibility(
  vacant: boolean,
  challengerCount: number,
): CourtActionsVisibility {
  return {
    showSupport: !vacant,
    showContest: true,
    showAttackers: !vacant && challengerCount > 0,
  }
}
