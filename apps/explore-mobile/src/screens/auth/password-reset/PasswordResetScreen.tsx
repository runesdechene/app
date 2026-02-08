import { BeginPasswordResetScreen } from '@/screens/auth/password-reset/BeginPasswordResetScreen'
import { EndPasswordResetScreen } from '@/screens/auth/password-reset/EndPasswordResetScreen'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { Screen } from '@ui'
import { useState } from 'react'

export const PasswordResetScreen = () => {
  const [step, setStep] = useState<'begin' | 'end'>('begin')
  const { router } = useDependencies()

  if (step === 'begin') {
    return (
      <Screen
        backButton={{
          label: 'Mot de passe oublié',
          onBackButton: () => router.resetTo('/'),
        }}
      >
        <BeginPasswordResetScreen
          onSuccess={() => setStep('end')}
          onSkip={() => setStep('end')}
        />
      </Screen>
    )
  } else if (step === 'end') {
    return (
      <Screen
        backButton={{
          label: 'Mot de passe oublié',
          onBackButton: () => setStep('begin'),
        }}
      >
        <EndPasswordResetScreen onSuccess={() => router.resetTo('/')} />
      </Screen>
    )
  }

  return null
}
