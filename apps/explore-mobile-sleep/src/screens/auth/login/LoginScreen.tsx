import { useSession } from '@/hooks/use-session'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useMutation } from '@tanstack/react-query'
import {
  Button,
  GapSeparator,
  Input,
  Logo,
  Screen,
  Text,
  useSnackbar,
} from '@ui'
import { useState } from 'react'

export const LoginScreen = () => {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')

  const session = useSession()
  const { router } = useDependencies()
  const snackbar = useSnackbar()

  const sendOtpMutation = useMutation({
    mutationFn: () => session.sendOtp({ email }),
    onSuccess: () => {
      setStep('code')
      snackbar.success('Code envoyé ! Vérifiez votre boîte mail.')
    },
    onError: error => {
      snackbar.error(error)
    },
  })

  const verifyOtpMutation = useMutation({
    mutationFn: () => session.verifyOtp({ email, code }),
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
        onBackButton: () => {
          if (step === 'code') {
            setStep('email')
            setCode('')
          } else {
            router.resetTo('/')
          }
        },
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

      {step === 'email' ? (
        <>
          <Text align="center">
            Entrez votre adresse e-mail pour recevoir un code de connexion.
          </Text>
          <GapSeparator />
          <Input
            placeholder="Adresse e-mail"
            keyboardType={'email-address'}
            value={email}
            onChangeText={setEmail}
          />
          <GapSeparator />
          <Button
            onPress={() => sendOtpMutation.mutate()}
            disable={sendOtpMutation.isPending || !email.trim()}
            color="primary"
          >
            Recevoir un code
          </Button>
        </>
      ) : (
        <>
          <Text align="center">
            Un code à 6 chiffres a été envoyé à {email}
          </Text>
          <GapSeparator />
          <Input
            placeholder="Code à 6 chiffres"
            keyboardType={'number-pad'}
            value={code}
            onChangeText={setCode}
            
          />
          <GapSeparator />
          <Button
            onPress={() => verifyOtpMutation.mutate()}
            disable={verifyOtpMutation.isPending || code.length !== 6}
            color="primary"
          >
            Valider
          </Button>
          <GapSeparator />
          <Button
            onPress={() => sendOtpMutation.mutate()}
            disable={sendOtpMutation.isPending}
          >
            Renvoyer le code
          </Button>
        </>
      )}
    </Screen>
  )
}
