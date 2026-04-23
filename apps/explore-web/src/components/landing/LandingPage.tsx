import { useState } from 'react'
import LandingContent from './LandingContent'
import LandingImage from './LandingImage'
import './LandingPage.css'

type Mode = 'default' | 'auth'

export default function LandingPage() {
  const [mode, setMode] = useState<Mode>('default')

  return (
    <div className="landing">
      <div className={`landing__parchment${mode === 'auth' ? ' is-auth-mode' : ''}`}>
        <div className="landing__view landing__view--default">
          <LandingContent onCtaClick={() => setMode('auth')} />
        </div>
        <div className="landing__view landing__view--auth">
          <p style={{ padding: '2rem' }}>Auth view (placeholder — Task 9)</p>
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
