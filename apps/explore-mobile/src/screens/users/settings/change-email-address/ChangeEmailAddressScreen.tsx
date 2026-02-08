import { usePresenter } from '@/screens/users/settings/change-email-address/use-presenter'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { ApiMyInformations } from '@model'
import { useQuery } from '@tanstack/react-query'
import { Button, ErrorScreen, Input, LoadingScreen, Screen } from '@ui'
import { router } from 'expo-router'

export const ChangeEmailAddressScreen = () => {
  const { accountGateway } = useDependencies()
  const query = useQuery({
    queryKey: ['my-account'],
    queryFn: () => accountGateway.getMyUser(),
  })

  if (query.isLoading) return <LoadingScreen />
  if (query.isError) return <ErrorScreen>{query.error}</ErrorScreen>

  return <PageContent user={query.data!} />
}

export const PageContent = ({ user }: { user: ApiMyInformations }) => {
  const { form } = usePresenter({ user })

  return (
    <Screen
      backButton={{
        label: 'adresse e-mail',
        onBackButton: () => router.back(),
      }}
    >
      <Input
        label={'Adresse e-mail'}
        value={form.values.emailAddress}
        errorMessage={form.errors.emailAddress}
        onChangeText={form.handleChange('emailAddress')}
      />
      <Button onPress={form.handleSubmit} color="primary">
        Terminer
      </Button>
    </Screen>
  )
}
