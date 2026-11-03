/**
 * QUOI     — le son du scan et de ce qu'il révèle : le bip (avec, là où ça existe, une petite
 *            vibration), et les applaudissements quand une carte se retourne (le bruitage de la
 *            conquête d'un lieu).
 * POURQUOI — Safari ne joue un son qu'après un toucher : le contexte audio se crée et se relance
 *            dans le geste qui ouvre le scanner (icône de l'en-tête, bouton « Scanner », « Creuser
 *            encore »). Les applaudissements passent par ce même contexte : la révélation s'ouvre
 *            après le bip, hors de tout geste, et un simple <audio> y serait refusé.
 *            L'iPhone ne vibre pas : le signal visuel (coins à la cire, nom) suffit.
 */
const APPLAUDISSEMENTS = `${import.meta.env.BASE_URL}res/etendard-plante.mp3`

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

let applaudissements: Promise<AudioBuffer> | null = null

export function applaudir(): void {
  if (!contexte) return
  const audio = contexte
  applaudissements ??= fetch(APPLAUDISSEMENTS)
    .then((reponse) => reponse.arrayBuffer())
    .then((octets) => audio.decodeAudioData(octets))
  applaudissements.then(
    (son) => {
      const lecture = audio.createBufferSource()
      lecture.buffer = son
      lecture.connect(audio.destination)
      lecture.start()
    },
    () => {
      applaudissements = null // réseau coupé : on retentera la prochaine fois
    },
  )
}
