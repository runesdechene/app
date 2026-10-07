/**
 * QUOI     — le claquement d'un sceau de cire qu'on brise : un bruit bref, sec, qui retombe.
 * POURQUOI — maquette « Énigmes — 3 » : le toucher d'un « ? » s'entend. Comme le tintement d'une
 *            découverte, du Web Audio : aucun fichier. Joué dans le geste du doigt, le navigateur le
 *            laisse passer ; un téléphone en silencieux le coupe. Les sons propres à chaque culture
 *            viendront plus tard (fichiers).
 */
export function claquerLaCire() {
  if (typeof AudioContext === 'undefined') return
  const audio = new AudioContext()
  const duree = 0.12
  const bruit = audio.createBuffer(1, Math.round(audio.sampleRate * duree), audio.sampleRate)
  const echantillons = bruit.getChannelData(0)
  for (let i = 0; i < echantillons.length; i++) {
    echantillons[i] = (Math.random() * 2 - 1) * (1 - i / echantillons.length) ** 3
  }
  const source = audio.createBufferSource()
  source.buffer = bruit
  const filtre = audio.createBiquadFilter()
  filtre.type = 'bandpass'
  filtre.frequency.value = 1800
  const volume = audio.createGain()
  volume.gain.value = 0.35
  source.connect(filtre).connect(volume).connect(audio.destination)
  source.start()
  setTimeout(() => void audio.close(), 500)
}
