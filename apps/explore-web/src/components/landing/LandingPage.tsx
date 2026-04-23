import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAppConfigStore } from '../../stores/appConfigStore'
import LandingContent from './LandingContent'
import LandingAuthForm from './LandingAuthForm'
import LandingImage from './LandingImage'
import './LandingPage.css'

type Mode = 'default' | 'auth'

export default function LandingPage() {
  const [mode, setMode] = useState<Mode>('default')
  const navigate = useNavigate()
  const { user } = useAuth()
  const landingImageDesktopUrl = useAppConfigStore(s => s.landingImageDesktopUrl)
  const landingImageMobileUrl = useAppConfigStore(s => s.landingImageMobileUrl)
  const landingFrameUrl = useAppConfigStore(s => s.landingFrameUrl)
  const configLoaded = useAppConfigStore(s => s.loaded)

  useEffect(() => {
    if (!configLoaded) {
      useAppConfigStore.getState().fetchConfig()
    }
  }, [configLoaded])

  function handleCtaClick() {
    if (user) {
      navigate('/carte')
    } else {
      setMode('auth')
    }
  }

  function handleAuthSuccess() {
    navigate('/carte')
  }

  function handleBack() {
    setMode('default')
  }

  return (
    <div className="landing">
      <div className="landing__parchment">
        <div className="landing__view">
          {mode === 'default' ? (
            <LandingContent onCtaClick={handleCtaClick} />
          ) : (
            <LandingAuthForm onSuccess={handleAuthSuccess} onBack={handleBack} />
          )}
        </div>
      </div>
      <div className="landing__image">
        <LandingImage
          imageDesktopUrl={landingImageDesktopUrl || undefined}
          imageMobileUrl={landingImageMobileUrl || undefined}
          framePngUrl={landingFrameUrl || undefined}
        />
      </div>
    </div>
  )
}
