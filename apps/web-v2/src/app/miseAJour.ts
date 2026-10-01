/**
 * QUOI     — tenir l'app à jour : le service worker est enregistré ici, cherche une nouvelle
 *            version toutes les heures et chaque fois que l'app revient au premier plan ; une fois
 *            installée, la page se recharge d'elle-même (mode « autoUpdate » de vite-plugin-pwa).
 * POURQUOI — Uriel, 01/10 : l'app installée restait sur « Pythéas 1.0.0 » malgré les
 *            déploiements. Sans ces vérifications, le navigateur ne cherche une nouvelle version
 *            qu'à une vraie navigation — rare dans une app qu'on garde ouverte.
 */
import { registerSW } from 'virtual:pwa-register'

const UNE_HEURE = 60 * 60 * 1000

export function tenirAJour() {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, enregistrement) {
      if (!enregistrement) return
      const verifier = () => {
        void enregistrement.update()
      }
      setInterval(verifier, UNE_HEURE)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') verifier()
      })
    },
  })
}
