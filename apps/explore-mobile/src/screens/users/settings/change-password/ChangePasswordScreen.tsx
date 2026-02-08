import { usePresenter } from '@/screens/users/settings/change-password/use-presenter'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { Button, Input, Screen } from '@ui'

export const ChangePasswordScreen = () => {
  const { form } = usePresenter()
  const { router } = useDependencies()

  return (
    <Screen
      backButton={{
        label: 'mot de passe',
        onBackButton: () => router.back(),
      }}
    >
      <Input
        label={'Nouveau mot de passe'}
        value={form.values.password}
        onChangeText={form.handleChange('password')}
        errorMessage={form.errors.password}
        secure
      />
      <Input
        label={'Confirmer le mot de passe'}
        value={form.values.passwordBis}
        onChangeText={form.handleChange('passwordBis')}
        errorMessage={form.errors.passwordBis}
        secure
      />
      <Button onPress={form.handleSubmit} color="primary">
        Terminer
      </Button>
    </Screen>
  )
}
