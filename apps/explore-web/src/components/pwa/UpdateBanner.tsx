import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import changelogRaw from '../../../CHANGELOG.md?raw'
import './UpdateBanner.css'

const SESSION_DISMISS_KEY = 'update-banner-modal-dismissed'

/** Version du bundle local — premier `# X.Y.Z` du CHANGELOG.md, parseé au build. */
const currentVersion =
  changelogRaw.split('\n').find((l) => l.startsWith('# '))?.slice(2).trim() ?? ''

/** Extrait [major, minor, patch] depuis une string type "ALPHA V0.7.10". */
function parseSemver(v: string): [number, number, number] {
  const m = v.match(/(\d+)\.(\d+)\.(\d+)/)
  if (!m) return [0, 0, 0]
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** True si local est strictement plus ancien que remote. */
function isLocalOlder(local: string, remote: string): boolean {
  const a = parseSemver(local)
  const b = parseSemver(remote)
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return true
    if (a[i] > b[i]) return false
  }
  return false
}

async function forceUpdate() {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      // unregister() côté client laisse le SW contrôleur actif jusqu'à
      // fermeture de toutes les pages. Le reload qui suivait était donc
      // intercepté par le SW mort-vivant et restait sur l'ancien bundle.
      // KILL_SWITCH demande au SW de se désinscrire depuis l'intérieur
      // — la seule façon de garantir qu'il lâche le contrôle.
      if (reg?.active) {
        reg.active.postMessage({ type: 'KILL_SWITCH' })
        await Promise.race([
          new Promise<void>((resolve) => {
            navigator.serviceWorker.addEventListener(
              'controllerchange',
              () => resolve(),
              { once: true },
            )
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        ])
      }
      // Cleanup défensif au cas où le SW n'aurait pas répondu
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    /* ignore — on recharge dans tous les cas */
  }
  // Hard nav avec cache buster pour bypass tout HTTP cache résiduel
  window.location.replace(window.location.pathname + '?_v=' + Date.now())
}

/**
 * V0.7.7 (10/05) — détection de mise à jour PWA en comparant la version du
 * bundle local (CHANGELOG.md) avec la version "publiée" stockée en DB
 * (app_settings.app.latest_version, à bumper à chaque deploy).
 *
 * Si différentes → bandeau doré sur la home + auto-modale au premier mount
 * de la session (dismissable). Bouton "Mettre à jour" = unregister SW +
 * clear caches + reload.
 */
export function UpdateBanner() {
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'app.latest_version')
      .single()
      .then(({ data }) => {
        if (cancelled) return
        if (data?.value) setLatestVersion(data.value as string)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // V0.7.10 (10/05) — bandeau uniquement si le bundle local est plus
  // ancien que la version publiée. Si local > remote (ex: oubli de sync
  // post-deploy), pas de bandeau, message inversé évité.
  const needsUpdate =
    !!latestVersion && !!currentVersion && isLocalOlder(currentVersion, latestVersion)

  useEffect(() => {
    if (!needsUpdate) return
    if (sessionStorage.getItem(SESSION_DISMISS_KEY) === '1') return
    setShowModal(true)
  }, [needsUpdate])

  function closeModal() {
    sessionStorage.setItem(SESSION_DISMISS_KEY, '1')
    setShowModal(false)
  }

  if (!needsUpdate) return null

  return (
    <>
      <button className="update-banner" onClick={() => setShowModal(true)}>
        <span className="update-banner-icon" aria-hidden>🔄</span>
        <span className="update-banner-text">
          Mise à jour disponible — touche ici pour mettre à jour
        </span>
      </button>

      {showModal &&
        createPortal(
          <div className="update-modal-overlay" onClick={closeModal}>
            <div className="update-modal" onClick={(e) => e.stopPropagation()}>
              <button className="update-modal-close" onClick={closeModal} aria-label="Fermer">
                ✕
              </button>
              <div className="update-modal-icon" aria-hidden>🔄</div>
              <h3 className="update-modal-title">Nouvelle version disponible</h3>
              <p className="update-modal-desc">
                Tu utilises <strong>{currentVersion}</strong>. La dernière version publiée est{' '}
                <strong>{latestVersion}</strong>.
              </p>
              <p className="update-modal-hint">
                Mets à jour pour bénéficier des derniers correctifs. L'app va recharger.
              </p>
              <div className="update-modal-actions">
                <button className="update-modal-btn-primary" onClick={forceUpdate}>
                  Mettre à jour maintenant
                </button>
                <button className="update-modal-btn-secondary" onClick={closeModal}>
                  Plus tard
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
