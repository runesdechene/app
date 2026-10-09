/**
 * QUOI     — tenir l'app à jour : le service worker est enregistré ici, cherche une nouvelle
 *            version toutes les heures et chaque fois que l'app revient au premier plan ; la base
 *            annonce la dernière version en ligne (`app_settings`, clé explore.version, écrite par
 *            scripts/sync-app-version.mjs après chaque déploiement). Une nouvelle version se
 *            signale (la fenêtre NouvelleVersion) au lieu de recharger la page en pleine saisie.
 * POURQUOI — Uriel, 01/10 : l'app installée restait sur « Pythéas 1.0.0 » malgré les
 *            déploiements. Uriel, 07/10 : retrouver la fenêtre de la V1, et son forçage.
 * ATTENTION — deux degrés. « prete » : le service worker a déjà pris la nouvelle version, un
 *            rechargement suffit. « forcee » : la base annonce plus récent mais le service worker
 *            n'a rien vu (coincé, piège du 02/10) — on vide les caches et on le désinscrit, comme
 *            la V1. Si l'Explorateur quitte l'app sans répondre, elle se recharge en partant :
 *            il n'était plus en train d'écrire.
 */
import { registerSW } from 'virtual:pwa-register'
import { estPlusRecente, NUMERO } from '@/shared/lib/version'
import { supabase } from '@/shared/supabase/client'

const UNE_HEURE = 60 * 60 * 1000

export type NouvelleVersion = 'prete' | 'forcee' | null

let nouvelle: NouvelleVersion = null
const ecouteurs = new Set<() => void>()

// La fenêtre lit et suit cet état (useSyncExternalStore).
export const nouvelleVersion = {
  lire: (): NouvelleVersion => nouvelle,
  suivre: (ecouteur: () => void) => {
    ecouteurs.add(ecouteur)
    return () => {
      ecouteurs.delete(ecouteur)
    }
  },
}

// « forcee » l'emporte sur « prete » : c'est le degré le plus sûr.
export function signalerNouvelleVersion(degre: 'prete' | 'forcee') {
  if (nouvelle === 'forcee' || nouvelle === degre) return
  nouvelle = degre
  for (const ecouteur of ecouteurs) ecouteur()
}

export async function recharger() {
  if (nouvelle === 'forcee') {
    for (const cle of await caches.keys()) await caches.delete(cle)
    for (const inscription of await navigator.serviceWorker.getRegistrations()) {
      await inscription.unregister()
    }
  }
  window.location.reload()
}

async function comparerALaBase() {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'explore.version')
    .maybeSingle()
  if (data && estPlusRecente(data.value, NUMERO)) signalerNouvelleVersion('forcee')
}

export function tenirAJour() {
  registerSW({
    immediate: true,
    // Le service worker a pris la nouvelle version : on le dit, sans recharger d'office.
    onNeedReload: () => {
      signalerNouvelleVersion('prete')
    },
    onRegisteredSW(_url, enregistrement) {
      const verifier = () => {
        void enregistrement?.update()
        void comparerALaBase()
      }
      verifier()
      setInterval(verifier, UNE_HEURE)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') verifier()
        else if (nouvelle) void recharger()
      })
    },
  })
}
