/**
 * QUOI     — le son d'un sceau qui se retourne : un souffle qui monte, puis une note ronde qui se
 *            pose (ré et la, ensemble).
 * POURQUOI — maquette « Énigmes — 3 » : le toucher d'un « ? » s'entend. Le premier essai, un bruit
 *            bref et sec, sonnait comme une claque (Uriel, 07/10) ; le souffle monte doucement et la
 *            note dit « révélé ». Du Web Audio : aucun fichier. Joué dans le geste du doigt, le
 *            navigateur le laisse passer ; un téléphone en silencieux le coupe.
 */
export function retournerLeSceau() {
  if (typeof AudioContext === 'undefined') return
  const audio = new AudioContext()
  const debut = audio.currentTime
  souffler(audio, debut, 0.32)
  for (const frequence of [587.3, 880]) sonner(audio, frequence, debut + 0.22, 1.1)
  setTimeout(() => void audio.close(), 1600)
}

// Un bruit doux dont le filtre monte : l'air que déplace le sceau en tournant.
function souffler(audio: AudioContext, debut: number, duree: number) {
  const bruit = audio.createBuffer(1, Math.round(audio.sampleRate * duree), audio.sampleRate)
  const echantillons = bruit.getChannelData(0)
  for (let i = 0; i < echantillons.length; i++) echantillons[i] = Math.random() * 2 - 1
  const source = audio.createBufferSource()
  source.buffer = bruit
  const filtre = audio.createBiquadFilter()
  filtre.type = 'bandpass'
  filtre.Q.value = 1.2
  filtre.frequency.setValueAtTime(400, debut)
  filtre.frequency.exponentialRampToValueAtTime(2200, debut + duree)
  const volume = audio.createGain()
  volume.gain.setValueAtTime(0.0001, debut)
  volume.gain.exponentialRampToValueAtTime(0.06, debut + duree * 0.6)
  volume.gain.exponentialRampToValueAtTime(0.0001, debut + duree)
  source.connect(filtre).connect(volume).connect(audio.destination)
  source.start(debut)
}

function sonner(audio: AudioContext, frequence: number, debut: number, duree: number) {
  const note = audio.createOscillator()
  note.frequency.value = frequence
  const volume = audio.createGain()
  volume.gain.setValueAtTime(0.0001, debut)
  volume.gain.exponentialRampToValueAtTime(0.06, debut + 0.03)
  volume.gain.exponentialRampToValueAtTime(0.0001, debut + duree)
  note.connect(volume).connect(audio.destination)
  note.start(debut)
  note.stop(debut + duree)
}
