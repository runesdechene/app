import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import LandingContent from './LandingContent'
import LandingAuthForm from './LandingAuthForm'
import LandingImage from './LandingImage'
import './LandingPage.css'

type Mode = 'default' | 'auth'

export default function LandingPage() {
  const [mode, setMode] = useState<Mode>('default')
  const navigate = useNavigate()
  const { user } = useAuth()

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
      <div className={`landing__parchment${mode === 'auth' ? ' is-auth-mode' : ''}`}>
        <div className="landing__view landing__view--default">
          <LandingContent onCtaClick={handleCtaClick} />
        </div>
        <div className="landing__view landing__view--auth">
          <LandingAuthForm onSuccess={handleAuthSuccess} onBack={handleBack} />
        </div>
      </div>
      <div className="landing__image">
        <LandingImage
          imageDesktopUrl={undefined}
          imageMobileUrl={undefined}
          framePngUrl={undefined}
        />
      </div>
    </div>
  )
}
