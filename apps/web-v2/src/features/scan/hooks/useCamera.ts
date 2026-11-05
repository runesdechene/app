/**
 * QUOI     — la caméra du viseur : l'arrière, ou l'avant pour scanner le t-shirt qu'on porte
 *            (des joueurs l'ont demandé, 05/11).
 * POURQUOI — elle s'éteint pour de bon quand on quitte le scanner ou qu'on la retourne : le voyant
 *            du téléphone ne doit pas rester allumé.
 */
import { useEffect, useState, type RefObject } from 'react'

export type EtatCamera = 'attente' | 'en-marche' | 'refusee'
export type Face = 'arriere' | 'avant'

export function useCamera(
  video: RefObject<HTMLVideoElement | null>,
  actif: boolean,
  face: Face,
): EtatCamera {
  const [etat, setEtat] = useState<EtatCamera>('attente')
  useEffect(() => {
    if (!actif) return
    let flux: MediaStream | null = null
    let parti = false
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: face === 'avant' ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      })
      .then((f) => {
        flux = f
        // Quitté avant que la caméra réponde : on l'éteint aussitôt.
        if (parti || !video.current) {
          for (const piste of f.getTracks()) piste.stop()
          return
        }
        video.current.srcObject = f
        void video.current.play()
        setEtat('en-marche')
      })
      .catch(() => {
        setEtat('refusee')
      })
    return () => {
      parti = true
      for (const piste of flux?.getTracks() ?? []) piste.stop()
    }
  }, [actif, video, face])
  return etat
}
