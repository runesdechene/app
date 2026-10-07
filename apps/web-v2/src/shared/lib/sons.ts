/**
 * QUOI     — les petits sons de l'app : le tintement d'une découverte ou d'une bonne réponse (trois
 *            notes claires qui montent), le même plus grave pour un titre gagné, et un soupir doux
 *            (deux notes qui descendent) pour une réponse fausse.
 * POURQUOI — le son du navigateur (Web Audio) suffit : aucun fichier à charger. Partagé par la
 *            fiche d'un lieu (Découvrir) et la carte (les énigmes, maquettes « 5b à 5d », 07/10).
 * ATTENTION — joué juste après un geste du doigt, le navigateur le laisse passer ; un téléphone en
 *            silencieux le coupe.
 */
function jouer(notes: number[], ecart: number, duree: number, volumeMax: number) {
  if (typeof AudioContext === 'undefined') return
  const audio = new AudioContext()
  notes.forEach((frequence, i) => {
    const debut = audio.currentTime + i * ecart
    const note = audio.createOscillator()
    const volume = audio.createGain()
    note.frequency.value = frequence
    volume.gain.setValueAtTime(0.0001, debut)
    volume.gain.exponentialRampToValueAtTime(volumeMax, debut + 0.02)
    volume.gain.exponentialRampToValueAtTime(0.0001, debut + duree)
    note.connect(volume).connect(audio.destination)
    note.start(debut)
    note.stop(debut + duree)
  })
  setTimeout(() => void audio.close(), (notes.length * ecart + duree) * 1000 + 300)
}

// mi, la, mi : un accord qui s'ouvre
export function tinter() {
  jouer([1318.5, 1760, 2637], 0.09, 0.6, 0.12)
}

// Le même accord, une octave plus bas et plus lent : un titre gagné.
export function tinterGrave() {
  jouer([659.3, 880, 1318.5], 0.14, 0.9, 0.12)
}

// do, sol : deux notes douces qui descendent — pas une sanction.
export function soupirer() {
  jouer([523.3, 392], 0.18, 0.5, 0.06)
}
