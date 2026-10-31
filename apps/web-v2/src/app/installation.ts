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

const PLUS_TARD = 'installation-plus-tard'

let demande: DemandeInstallation | null = null
let repoussee = lireRepoussee()
const ecouteurs = new Set<() => void>()

function prevenir() {
  for (const ecouteur of ecouteurs) ecouteur()
}

function lireRepoussee() {
  try {
    return sessionStorage.getItem(PLUS_TARD) === '1'
  } catch {
    return false
  }
}

// L'invitation et le menu du profil lisent et suivent cet état (useSyncExternalStore).
export const installation = {
  // vrai si le navigateur sait installer de lui-même (Android, Chrome sur PC)
  possible: () => demande !== null,
  // vrai si la croix a fait taire l'invitation jusqu'à la prochaine ouverture
  repoussee: () => repoussee,
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

// La croix de l'invitation, puis la ligne du menu qui la fait revenir.
export function repousserInvitation(oui: boolean) {
  repoussee = oui
  try {
    if (oui) sessionStorage.setItem(PLUS_TARD, '1')
    else sessionStorage.removeItem(PLUS_TARD)
  } catch {
    // Rien à faire : l'état en mémoire suffit jusqu'à la prochaine ouverture.
  }
  prevenir()
}

export function estInstallee() {
  return window.matchMedia('(display-mode: standalone)').matches
}

// Safari ne sait pas installer de lui-même : on montre le geste.
export function surIPhone() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}
