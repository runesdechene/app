/**
 * QUOI     — si le cartouche « Nouveau ici ? » du Codex a été fermé sur cet appareil.
 * ATTENTION — gardé sur l'appareil ; s'il ne peut pas l'être (navigation privée), le cartouche
 *            reviendra à la prochaine ouverture, sans plus.
 */
const FERME = 'codex-nouveau-ici-ferme'

export function cartoucheFerme() {
  try {
    return localStorage.getItem(FERME) === '1'
  } catch {
    return false
  }
}

export function fermerCartouche() {
  try {
    localStorage.setItem(FERME, '1')
  } catch {
    // Rien à faire : il reviendra à la prochaine ouverture.
  }
}
