import {
  Button,
  Colors,
  Flex,
  GapSeparator,
  IconContainer,
  Screen,
  Text,
  TextBold,
} from '@ui'
import { router } from 'expo-router'

export const SensibleScreen = () => {
  return (
    <Screen
      backButton={{
        label: 'lieu sensible',
        onBackButton: () => router.back(),
      }}
    >
      <Flex gap="L" center>
        <IconContainer
          name="alert"
          size="XL"
          color={Colors.button.red.text.default}
        />
        <GapSeparator />
        <Text>
          Les lieux sensibles sont des emplacements qui ont été{' '}
          <TextBold>
            sciemment indiqués comme fragiles, rares ou prompt à l'usure.
          </TextBold>
        </Text>
        <GapSeparator />
        <Text>
          Ils ne sont affichés qu'aux utilisateurs les plus actifs, auquel nous
          demandons la plus grande attention.
        </Text>
        <GapSeparator />
        <Text>
          Ces lieux en particulier demandent votre vigilance afin de le garder
          propre et peu touristique. Nous comptons sur vous pour faire preuve de
          civisme et d'initiative à la fois humaine et écologique, afin de le
          préserver, afin que nous puissions continuer à les proposer à notre
          communauté.
        </Text>
        <GapSeparator />
        <Text>Soyez à la hauteur des valeurs de Runes de Chêne,</Text>
        <GapSeparator />
        <Text>et bonne exploration !</Text>
        <GapSeparator />
        <Button color="special" onPress={() => router.back()}>
          Comptez sur moi!
        </Button>
      </Flex>
    </Screen>
  )
}
