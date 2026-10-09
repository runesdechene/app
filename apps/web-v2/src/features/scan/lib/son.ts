/**
 * QUOI     — le bip du scan : un son court et, là où ça existe (Android), une petite vibration.
 * POURQUOI — Safari ne joue un son qu'après un toucher : le contexte audio se crée et se relance
 *            dans le geste qui ouvre le scanner (icône de l'en-tête, ou bouton « Scanner »).
 *            L'iPhone ne vibre pas : le signal visuel (coins à la cire, nom) suffit.
 */
let contexte: AudioContext | null = null

export function debloquerSon(): void {
  contexte ??= new AudioContext()
  void contexte.resume()
}

export function sonDebloque(): boolean {
  return contexte?.state === 'running'
}

export function biper(): void {
  if ('vibrate' in navigator) navigator.vibrate(60) // absent sur iPhone
  if (!contexte) return
  const oscillateur = contexte.createOscillator()
  const volume = contexte.createGain()
  oscillateur.frequency.value = 1320
  oscillateur.connect(volume)
  volume.connect(contexte.destination)
  volume.gain.setValueAtTime(0.25, contexte.currentTime)
  volume.gain.exponentialRampToValueAtTime(0.001, contexte.currentTime + 0.18)
  oscillateur.start()
  oscillateur.stop(contexte.currentTime + 0.2)
}
