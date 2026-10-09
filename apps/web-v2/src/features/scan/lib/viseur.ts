/**
 * QUOI     — le carré du viseur, tel qu'on l'envoie au modèle.
 * POURQUOI — le viseur couvre 76 % de la largeur ; on ne compare que ce qu'il encadre (essai du 09/10).
 */
export const COTE = 256
export const PART = 0.76

export function cadrer(video: HTMLVideoElement, toile: HTMLCanvasElement): HTMLCanvasElement {
  const cote = Math.min(video.videoWidth, video.videoHeight) * PART
  toile.width = COTE
  toile.height = COTE
  toile
    .getContext('2d')
    ?.drawImage(
      video,
      (video.videoWidth - cote) / 2,
      (video.videoHeight - cote) / 2,
      cote,
      cote,
      0,
      0,
      COTE,
      COTE,
    )
  return toile
}
