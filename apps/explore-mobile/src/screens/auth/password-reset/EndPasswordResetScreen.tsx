import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useMutation } from '@tanstack/react-query'
import { Button, GapSeparator, Input, Logo, useSnackbar } from '@ui'
import { useState } from 'react'

export const EndPasswordResetScreen = ({
  onSuccess,
}: {
  onSuccess?: () => void
}) => {
  const [code, setCode] = useState('')
  const [nextPassword, setNextPassword] = useState('')

  const { sessionGateway } = useDependencies()
  const snackbar = useSnackbar()

  const mutation = useMutation({
    mutationFn: async () => {
      return sessionGateway.endPasswordReset({
        code,
        nextPassword,
      })
    },
    onSuccess: () => {
      onSuccess?.()
    },
    onError: error => {
      snackbar.error(error)
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
        placeholder="Code envoyé par e-mail"
        value={code}
        onChangeText={setCode}
      />
      <Input
        placeholder="Mot de passe"
        secure={true}
        value={nextPassword}
        onChangeText={setNextPassword}
      />
      <GapSeparator />
      <Button
        onPress={() => mutation.mutate()}
        disable={mutation.isPending}
        color="primary"
      >
        Réinitialiser
      </Button>
    </>
  )
}
