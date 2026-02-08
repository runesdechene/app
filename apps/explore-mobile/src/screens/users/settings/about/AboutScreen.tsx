import { useDependencies } from '@/ui/dependencies/Dependencies'
import { Flex, Screen, Text } from '@ui'

export const AboutScreen = () => {
  const { router } = useDependencies()
  return (
    <Screen
      backButton={{ label: 'A propos', onBackButton: () => router.back() }}
    >
      <Flex>
        <Text>Application développée avec amour par Runes de Chêne.</Text>
      </Flex>
    </Screen>
  )
}
