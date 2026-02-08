import { usePresenter } from '@/screens/users/settings/change-informations/use-presenter'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { ApiMyInformations } from '@model'
import { useQuery } from '@tanstack/react-query'
import {
  AvatarLink,
  Button,
  ErrorScreen,
  Flex,
  ImageListItem,
  Input,
  LoadingScreen,
  Screen,
  Sizes,
} from '@ui'
import { View } from 'react-native'

export const ChangeInformationsScreen = () => {
  const { accountGateway } = useDependencies()
  const query = useQuery({
    queryKey: ['my-account'],
    queryFn: () => accountGateway.getMyUser(),
  })

  if (query.isLoading) return <LoadingScreen />
  if (query.isError) return <ErrorScreen>{query.error}</ErrorScreen>

  return <PageContent user={query.data!} />
}

const PageContent = ({ user }: { user: ApiMyInformations }) => {
  const { router } = useDependencies()
  const { form, isSubmittable, pickImage, deleteImage } = usePresenter({
    user,
  })

  return (
    <Screen
      backButton={{
        label: 'Modifier mon profil',
        onBackButton: () => router.back(),
      }}
    >
      <Flex gap="L" center={true}>
        {form.values.profileImage ? (
          <View style={{ height: Sizes.avatar.XL, width: Sizes.avatar.XL }}>
            <ImageListItem
              image={form.values.profileImage}
              actionButton={{ action: deleteImage, iconName: 'trash' }}
              mode="round"
            />
          </View>
        ) : (
          <AvatarLink size="XL" onPress={pickImage} text="Avatar" />
        )}
        <Input
          label={"Nom d'aventurier"}
          value={form.values.lastName}
          errorMessage={form.errors.lastName}
          onChangeText={form.handleChange('lastName')}
        />
        <Input
          label={'Identifiant Instagram'}
          value={form.values.instagramId}
          errorMessage={form.errors.instagramId}
          onChangeText={form.handleChange('instagramId')}
        />
        <Input
          placeholder="https://"
          label={'Site Web'}
          value={form.values.websiteUrl}
          errorMessage={form.errors.websiteUrl}
          onChangeText={form.handleChange('websiteUrl')}
        />
        <Input
          label={'Parlez un peu de vous'}
          value={form.values.biography}
          errorMessage={form.errors.biography}
          onChangeText={form.handleChange('biography')}
          multiline
        />
        <Button
          onPress={form.handleSubmit}
          disable={!isSubmittable}
          color="primary"
        >
          Terminer
        </Button>
      </Flex>
    </Screen>
  )
}
