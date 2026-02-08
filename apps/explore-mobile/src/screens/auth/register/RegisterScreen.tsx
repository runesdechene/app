import { useDependencies } from '@/ui/dependencies/Dependencies'
import { Button, GapSeparator, InlineLink, Input, Screen, Text } from '@ui'
import { usePresenter } from './hooks/use-presenter'

export const RegisterScreen = () => {
  const { form } = usePresenter()
  const { router } = useDependencies()

  return (
    <Screen
      backButton={{
        label: 'Créer un compte',
        onBackButton: () => router.resetTo('/'),
      }}
    >
      <Input
        label={"Nom d'aventurier"}
        value={form.values.lastName}
        errorMessage={form.errors.lastName}
        onChangeText={newVal => form.setFieldValue('lastName', newVal)}
      />
      <Input
        label={'Adresse e-mail'}
        value={form.values.emailAddress}
        errorMessage={form.errors.emailAddress}
        onChangeText={newVal => form.setFieldValue('emailAddress', newVal)}
        keyboardType={'email-address'}
      />
      <Input
        label={'Mot de passe'}
        helper={'Au moins 8 caractères, 1 minuscule, 1 majuscule, 1 chiffre.'}
        value={form.values.password}
        errorMessage={form.errors.password}
        onChangeText={newVal => form.setFieldValue('password', newVal)}
        secure={true}
      />
      <Input
        label={'Confirmez le mot de passe'}
        value={form.values.passwordConfirmation}
        errorMessage={form.errors.passwordConfirmation}
        onChangeText={newVal =>
          form.setFieldValue('passwordConfirmation', newVal)
        }
        secure={true}
      />
      <GapSeparator />
      <GapSeparator />
      <GapSeparator />
      <Text align="justify">
        En m'inscrivant, je déclare avoir lu et accepter nos{' '}
        <InlineLink href="https://runesdechene.com/pages/runes-de-chene-explore-politique-de-confidentialite">
          Conditions Générales d'Utilisations
        </InlineLink>{' '}
        et notre{' '}
        <InlineLink href="https://runesdechene.com/pages/confidentialite-runes-de-chene-explore/">
          Politique de Confidentialité
        </InlineLink>
      </Text>
      <GapSeparator />
      <GapSeparator />
      <GapSeparator />
      <Button
        onPress={form.handleSubmit}
        disable={form.isSubmitting}
        color="primary"
      >
        Créer mon compte
      </Button>
    </Screen>
  )
}
