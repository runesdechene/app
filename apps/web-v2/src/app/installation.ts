/**
 * QUOI     — la demande d'installation du navigateur (Android, Chrome sur PC), captée dès le
 *            chargement et gardée pour l'invitation « Installer Runes de Chêne ».
 * POURQUOI — Chrome ne tire `beforeinstallprompt` qu'une fois par chargement, avant que React ne
 *            monte quoi que ce soit : écouté plus tard, il est perdu (piège payé en V1).
 * ATTENTION — Safari ne tire jamais cet événement : sur iPhone, l'invitation guide à la main.
 */

interface DemandeInstallation extends Event {
  prompt: () => Promise<void>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: DemandeInstallation
  }
}

let demande: DemandeInstallation | null = null
const ecouteurs = new Set<() => void>()

function prevenir() {
  for (const ecouteur of ecouteurs) ecouteur()
}

// L'invitation lit et suit cet état (useSyncExternalStore) : vrai si le navigateur sait installer.
export const installation = {
  possible: () => demande !== null,
  suivre: (ecouteur: () => void) => {
    ecouteurs.add(ecouteur)
    return () => {
      ecouteurs.delete(ecouteur)
    }
  },
}

export function ecouterInstallation() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // pas la mini-barre de Chrome : notre invitation la remplace
    demande = e
    prevenir()
  })
  window.addEventListener('appinstalled', () => {
    demande = null
    prevenir()
  })
}

// La fenêtre native du navigateur ; la demande ne sert qu'une fois, accordée ou non.
export async function installer() {
  const d = demande
  demande = null
  prevenir()
  await d?.prompt()
}

export function estInstallee() {
  return window.matchMedia('(display-mode: standalone)').matches
}
