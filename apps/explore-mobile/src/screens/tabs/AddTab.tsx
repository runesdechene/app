import { useSession } from '@/hooks/use-session'
import { useAdminRootPlaceTypesQuery } from '@/queries/use-admin-root-place-types-query'
import { useRootPlaceTypesQuery } from '@/queries/use-root-place-types-query'
import { useTotalPlacesQuery } from '@/queries/use-total-places-query'
import { LoginScreen } from '@/screens/auth/login/LoginScreen'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import {
  ButtonPicto,
  Colors,
  Flex,
  GapSeparator,
  IconContainer,
  Loader,
  Screen,
  Text,
  Title,
} from '@ui'

export const AddTab = () => {
  const session = useSession()
  return session.isAuthenticated ? <AuthenticatedTab /> : <GuestTab />
}

const AuthenticatedTab = () => {
  const placeTypes = useRootPlaceTypesQuery()
  const adminPlaceTypes = useAdminRootPlaceTypesQuery()

  const { router } = useDependencies()

  const queryStat = useTotalPlacesQuery()

  if (placeTypes.isLoading || !placeTypes.data || adminPlaceTypes.isLoading) {
    return (
      <Screen
        backButton={{
          label: 'Ajouter un lieu',
          onBackButton: () => router.back(),
        }}
      >
        <Title size="h1">Que souhaitez-vous ajouter ?</Title>
        <Loader />
      </Screen>
    )
  }

  const mergedPlacesTypes = [
    ...(placeTypes.data ?? []),
    ...(adminPlaceTypes.data ?? []),
  ]

  return (
    <Screen
      backButton={{
        label: 'Ajouter un lieu',
        onBackButton: () => router.back(),
      }}
    >
      <Flex gap="L" center key="flexOne">
        <Title size="h1" center>
          Que souhaitez-vous ajouter ?
        </Title>
        {mergedPlacesTypes.map(placeType => (
          <>
            <ButtonPicto
              buttonType={placeType.images.local as any}
              key={placeType.id}
              size="M"
              active
              onPress={() =>
                router.push(`/add-place?placeTypeId=${placeType.id}`)
              }
            >
              {placeType.title}
            </ButtonPicto>
          </>
        ))}
        {queryStat.data && (
          <>
            <GapSeparator />
            <GapSeparator />
            <GapSeparator />
            <IconContainer size="XL" name="compass" color={Colors.label} />
            <Text color={Colors.label} align="center">
              Déjà {queryStat.data.count} lieux ajoutés
            </Text>
          </>
        )}
      </Flex>
    </Screen>
  )
}

const GuestTab = () => {
  return <LoginScreen />
}
