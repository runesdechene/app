// Auto-récupération des échecs de chargement de chunk (import dynamique).
//
// Symptôme corrigé : écran blanc au lancement, résolu par une relance manuelle.
// Cause : après un déploiement, un client qui a encore l'ancien index.html
// demande des chunks hashés qui n'existent plus (nettoyés par le SW / supprimés
// sur Netlify) → l'`import()` dynamique est rejeté. Sans Error Boundary ni
// fallback, l'exception démonte tout l'arbre React → page blanche permanente.
//
// Ici on intercepte l'event Vite `vite:preloadError` (échec de préchargement
// d'un module) et on recharge UNE fois la page pour repartir sur un build
// cohérent. Garde anti-boucle par timestamp : si on a déjà rechargé il y a
// moins de RELOAD_WINDOW_MS, on ne recharge pas (l'Error Boundary affiche alors
// un écran neutre plutôt que de boucler).

const RELOAD_TS_KEY = 'chunk-reload-ts'
const RELOAD_WINDOW_MS = 10_000

/** Reconnaît une erreur d'échec de chargement de module/chunk dynamique. */
export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false
  const e = err as { name?: string; message?: string }
  const name = e.name ?? ''
  const msg = e.message ?? ''
  return (
    name === 'ChunkLoadError' ||
    /dynamically imported module|imported module script failed|error loading dynamically|Failed to fetch dynamically/i.test(
      msg,
    )
  )
}

/**
 * Recharge la page une seule fois pour récupérer d'une erreur de chunk.
 * Retourne true si un reload a été déclenché, false si la garde l'a bloqué
 * (reload déjà tenté récemment → laisser l'Error Boundary afficher le fallback).
 */
export function reloadOnceForChunkError(): boolean {
  let last = 0
  try {
    last = Number(sessionStorage.getItem(RELOAD_TS_KEY) ?? 0)
  } catch {
    // sessionStorage indisponible (mode privé strict) → on tente quand même
  }
  if (Date.now() - last < RELOAD_WINDOW_MS) return false
  try {
    sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()))
  } catch {
    // ignore
  }
  window.location.reload()
  return true
}

if (typeof window !== 'undefined') {
  // Échec de préchargement d'un import dynamique (Vite). Sans preventDefault,
  // Vite relance l'erreur → crash non catché.
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    reloadOnceForChunkError()
  })
}
