import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useMutation } from '@tanstack/react-query'
import { Button, Colors, GapSeparator, Input, Logo, TextLink } from '@ui'
import { useState } from 'react'

export const BeginPasswordResetScreen = ({
  onSuccess,
  onSkip,
}: {
  onSuccess?: () => void
  onSkip?: () => void
}) => {
  const [emailAddress, setEmailAddress] = useState('')
  const [emailError, setEmailError] = useState('')

  const { sessionGateway } = useDependencies()

  const mutation = useMutation({
    mutationFn: async () => {
      return sessionGateway.beginPasswordReset({
        emailAddress,
      })
    },
    onSuccess: () => {
      onSuccess?.()
    },
    onError: () => {
      setEmailError('Une erreur est survenue, veuillez recommencer')
    },
  })

  return (
    <>
      <GapSeparator />
      <GapSeparator />
      <GapSeparator />
      <GapSeparator />
      <GapSeparator />
      <Logo />
      <GapSeparator />
      <GapSeparator />
      <GapSeparator />
      <GapSeparator />
      <GapSeparator />
      <Input
        placeholder="Adresse e-mail"
        keyboardType={'email-address'}
        value={emailAddress}
        onChangeText={setEmailAddress}
        errorMessage={emailError}
      />
      <GapSeparator />
      <Button
        onPress={() =>
          !emailAddress ? setEmailError('Champ obligatoire') : mutation.mutate()
        }
        disable={mutation.isPending}
        color="primary"
      >
        Réinitialiser
      </Button>
      <GapSeparator />
      <TextLink
        onPress={() => onSkip && onSkip()}
        color={Colors.label}
        align="center"
      >
        J'ai déjà un code
      </TextLink>
    </>
  )
}
