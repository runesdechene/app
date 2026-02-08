import { useSession } from '@/hooks/use-session'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useMutation } from '@tanstack/react-query'
import {
  Button,
  Colors,
  GapSeparator,
  Input,
  Logo,
  Screen,
  TextLink,
  useSnackbar,
} from '@ui'
import { useState } from 'react'

export const LoginScreen = () => {
  const [emailAddress, setEmailAddress] = useState('')
  const [password, setPassword] = useState('')

  const session = useSession()
  const { router } = useDependencies()
  const snackbar = useSnackbar()

  const mutation = useMutation({
    mutationFn: () => {
      return session.signIn({
        emailAddress,
        password,
      })
    },
    onSuccess: () => {
      router.resetTo('/home')
    },
    onError: error => {
      snackbar.error(error)
    },
  })

  return (
    <Screen
      backButton={{
        label: 'Connexion',
        onBackButton: () => router.resetTo('/'),
      }}
    >
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
      />
      <Input
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secure={true}
      />
      <GapSeparator />
      <Button
        onPress={() => mutation.mutate()}
        disable={mutation.isPending}
        color="primary"
      >
        Connexion
      </Button>
      <GapSeparator />
      <TextLink
        onPress={() => router.push('/password-reset')}
        color={Colors.label}
        align="center"
      >
        Mot de passe oublié
      </TextLink>
    </Screen>
  )
}
