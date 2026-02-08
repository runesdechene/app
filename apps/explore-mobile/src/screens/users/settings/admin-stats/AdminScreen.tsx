import { useAdminStatsQuery } from '@/queries/use-admin-stats-query'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import {
  Flex,
  GapSeparator,
  LoadingScreen,
  Screen,
  Text,
  TextBold,
  Title,
} from '@ui'

export const AdminScreen = () => {
  const { router } = useDependencies()
  const query = useAdminStatsQuery()

  if (query.isLoading) {
    return <LoadingScreen />
  }

  const StatComponent = ({ stat, label }: { stat?: number; label: string }) => {
    return (
      <Flex direction="column" gap="NONE" center style={{ flexGrow: 1 }}>
        <Title center>{stat}</Title>
        <Text align="center">{label}</Text>
      </Flex>
    )
  }

  return (
    <Screen
      backButton={{ label: 'Statistiques', onBackButton: () => router.back() }}
    >
      <Flex direction="column" center gap="M">
        <StatComponent stat={query.data?.nbUsers} label="utilisateurs" />
        <Text align="center">
          <TextBold align="center">
            {query.data?.nbUsersConnectedLast30Days}
          </TextBold>{' '}
          se sont connectés les 30 derniers jours
        </Text>
        <GapSeparator />
        <GapSeparator separator />
        <GapSeparator />
        <StatComponent
          stat={query.data?.nbUsersSignInLast7Days}
          label="inscriptions sur les 7 derniers jours"
        />
        <GapSeparator />
        <GapSeparator separator />
        <GapSeparator />
        <Flex direction="row" center>
          <StatComponent stat={query.data?.nbUsersAndroid} label="Android" />
          <StatComponent stat={query.data?.nbUsersApple} label="Apple" />
          <StatComponent stat={query.data?.nbUsersOthers} label="Autre" />
        </Flex>
        <GapSeparator />
        <GapSeparator separator />
        <GapSeparator />
        <StatComponent stat={query.data?.nbPlaces} label="lieux" />
        <Text align="center">
          <TextBold align="center">
            {query.data?.nbPlacesAddedLast30Days}
          </TextBold>{' '}
          ajoutés sur les 30 derniers jours
        </Text>
        <GapSeparator />
        <GapSeparator separator />
        <GapSeparator />
        <StatComponent stat={query.data?.nbReviews} label="commentaires" />
        <Text align="center">
          <TextBold align="center">
            {query.data?.nbReviewsAddedLast30Days}
          </TextBold>{' '}
          ajoutés sur les 30 derniers jours
        </Text>
      </Flex>
    </Screen>
  )
}
