/**
 * QUOI     — le petit tintement d'une découverte : trois notes claires qui montent.
 * POURQUOI — le son du navigateur (Web Audio) suffit : aucun fichier à charger. Il suit un geste
 *            du doigt, donc le navigateur le laisse jouer ; le téléphone en silencieux le coupe.
 */
const NOTES = [1318.5, 1760, 2637] // mi, la, mi : un accord qui s'ouvre

export function tinter() {
  if (typeof AudioContext === 'undefined') return
  const audio = new AudioContext()
  NOTES.forEach((frequence, i) => {
    const debut = audio.currentTime + i * 0.09
    const note = audio.createOscillator()
    const volume = audio.createGain()
    note.frequency.value = frequence
    volume.gain.setValueAtTime(0.0001, debut)
    volume.gain.exponentialRampToValueAtTime(0.12, debut + 0.02)
    volume.gain.exponentialRampToValueAtTime(0.0001, debut + 0.6)
    note.connect(volume).connect(audio.destination)
    note.start(debut)
    note.stop(debut + 0.6)
  })
  setTimeout(() => void audio.close(), 1500)
}
