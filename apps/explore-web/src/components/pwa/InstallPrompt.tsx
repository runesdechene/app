import { useState, useEffect } from 'react'
import './InstallPrompt.css'
import { getInstallPrompt, subscribeInstall, triggerInstall } from '../../lib/pwaInstall'

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Deja installe en PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (sessionStorage.getItem('pwa-install-dismissed')) return

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)

    if (isIOSDevice && isSafari) {
      // iOS : pas de beforeinstallprompt, on montre le guide apres 30s
      const timer = setTimeout(() => {
        if (!sessionStorage.getItem('pwa-install-dismissed')) {
          setIsIOS(true)
          setShowPrompt(true)
        }
      }, 30000)
      return () => clearTimeout(timer)
    }

    // Android/Chrome : l'evenement a pu etre capture AVANT le montage de ce
    // composant (capture globale dans lib/pwaInstall, des le chargement). On lit
    // l'etat courant puis on s'abonne aux captures ulterieures.
    if (getInstallPrompt()) setShowPrompt(true)
    return subscribeInstall(() => {
      const available = getInstallPrompt() !== null
      setShowPrompt(available && !sessionStorage.getItem('pwa-install-dismissed'))
    })
  }, [])

  async function handleInstall() {
    const outcome = await triggerInstall()
    if (outcome === 'accepted' || outcome === 'unavailable') {
      setShowPrompt(false)
    }
  }

  function handleDismiss() {
    setShowPrompt(false)
    sessionStorage.setItem('pwa-install-dismissed', '1')
  }

  if (!showPrompt) return null

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <img src="/pwa-192x192.png" alt="" className="install-prompt-icon" />
        <div className="install-prompt-text">
          <strong>Installer l'application</strong>
          <span>
            {isIOS
              ? "Appuyez sur Partager puis \"Sur l'ecran d'accueil\""
              : "Accedez a la carte depuis votre ecran d'accueil"}
          </span>
        </div>
      </div>
      <div className="install-prompt-actions">
        {!isIOS && (
          <button className="install-prompt-btn" onClick={handleInstall}>
            Installer
          </button>
        )}
        <button className="install-prompt-dismiss" onClick={handleDismiss}>
          &#10005;
        </button>
      </div>
    </div>
  )
}
