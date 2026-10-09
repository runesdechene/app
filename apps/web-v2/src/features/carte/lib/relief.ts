/**
 * QUOI     — quand le relief se lève en 3D.
 * POURQUOI — le terrain 3D coûte cher sur un téléphone : il ne s'allume que si l'on incline la
 *            carte et qu'on la regarde d'assez près (spec Carte §2). À plat, l'ombrage suffit.
 */
export const reliefVoulu = (inclinaison: number, zoom: number) => inclinaison > 15 && zoom >= 9
