import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAppConfigStore } from '../../stores/appConfigStore'
import LandingContent from './LandingContent'
import LandingAuthForm from './LandingAuthForm'
import LandingActivityFeed from './LandingActivityFeed'
import shopIcon from '../../assets/shop_icon.webp'
import './LandingPage.css'

type Mode = 'default' | 'auth'

export default function LandingPage() {
  const [mode, setMode] = useState<Mode>('default')
  const navigate = useNavigate()
  const { user } = useAuth()
  const landingImageDesktopUrl = useAppConfigStore(s => s.landingImageDesktopUrl)
  const landingImageMobileUrl = useAppConfigStore(s => s.landingImageMobileUrl)
  const landingFrameUrl = useAppConfigStore(s => s.landingFrameUrl)
  const landingLogoUrl = useAppConfigStore(s => s.landingLogoUrl)
  const configLoaded = useAppConfigStore(s => s.loaded)

  useEffect(() => {
    if (!configLoaded) {
      useAppConfigStore.getState().fetchConfig()
    }
  }, [configLoaded])

  function handleCtaClick() {
    if (user) {
      navigate('/post-login')
    } else {
      setMode('auth')
    }
  }

  function handleAuthSuccess() {
    navigate('/post-login')
  }

  function handleBack() {
    setMode('default')
  }

  return (
    <div className="landing">
      {(landingImageDesktopUrl || landingImageMobileUrl) && (
        <div className="landing__bg" aria-hidden="true">
          <picture>
            {landingImageMobileUrl && (
              <source media="(max-width: 749px)" srcSet={landingImageMobileUrl} />
            )}
            <img
              src={landingImageDesktopUrl || landingImageMobileUrl}
              alt=""
              className="landing__bg-img"
              loading="eager"
            />
          </picture>
        </div>
      )}

      {landingFrameUrl && (
        <div className="landing__frame" aria-hidden="true">
          <img
            src={landingFrameUrl}
            alt=""
            className="landing__frame-img"
            loading="eager"
          />
        </div>
      )}

      <div className="landing__content-wrapper">
        <div className={`landing__view landing__view--${mode}`} key={mode}>
          {mode === 'default' ? (
            <LandingContent onCtaClick={handleCtaClick} logoUrl={landingLogoUrl || undefined} />
          ) : (
            <LandingAuthForm onSuccess={handleAuthSuccess} onBack={handleBack} />
          )}
        </div>
        <p className="landing__footer">Application développée par la marque Runes de Chêne©, tous droits réservés.</p>
      </div>

      <a
        href="https://runesdechene.com"
        className="landing__shop-link"
        aria-label="Visiter la boutique officielle"
      >
        <img src={shopIcon} alt="" className="landing__shop-icon" />
        <span>Accéder à la boutique</span>
      </a>

      <LandingActivityFeed onToastClick={handleCtaClick} />
    </div>
  )
}
