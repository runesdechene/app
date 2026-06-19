// Capture GLOBALE et PRÉCOCE de l'événement `beforeinstallprompt`.
//
// Chrome ne tire cet événement qu'UNE seule fois par chargement de page, très
// tôt — bien avant que React ne monte une route donnée. Si le listener vit dans
// un composant de route (l'ancien InstallPrompt n'était monté que sur /carte),
// le nouvel arrivant qui entre par `/` (landing) puis `/accueil` rate
// l'événement : il est définitivement perdu pour la session (Chrome ne le
// re-tire pas au changement de route). D'où la disparition du pop-up d'install.
//
// Ce module écoute au plus tôt (importé depuis main.tsx, avant le render), met
// l'événement en cache et le rediffuse à qui veut l'afficher ensuite, quelle
// que soit la route d'arrivée.

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Empêche la mini-infobar Chrome par défaut : on pilote notre propre UI.
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    notify()
  })
}

/** L'événement capturé (ou null s'il n'a pas encore été tiré / déjà consommé). */
export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt
}

/** True si l'app a été installée pendant cette session. */
export function isAppInstalled(): boolean {
  return installed
}

/** S'abonne aux changements (capture de l'event / app installée). Retourne un unsub. */
export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Déclenche le prompt natif d'installation et nettoie le cache. */
export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  notify()
  return outcome
}
