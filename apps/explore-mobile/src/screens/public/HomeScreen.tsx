import { useDependencies } from '@/ui/dependencies/Dependencies'
import {
  Button,
  Colors,
  GapSeparator,
  InlineLink,
  Logo,
  Screen,
  Text,
  TextBold,
  TextBoldLink,
  TextLink,
} from '@ui'
import * as ExpoLinking from 'expo-linking'
import React from 'react'

export const HomeScreen = () => {
  const { router } = useDependencies()

  return (
    <Screen footer={{}}>
      <GapSeparator />
      <GapSeparator />
      <GapSeparator />
      <Logo />
      <GapSeparator />
      <Text>
        Bienvenue sur l'application officielle de la marque{' '}
        <InlineLink href="https://runesdechene.com/pages/runes-de-chene-explore-politique-de-confidentialite">
          Runes de Chêne
        </InlineLink>
        .
      </Text>
      <GapSeparator />
      <Text>
        Sa mission ? Vous encourager à redécouvrir vos contrées et faire de vous
        un aventurier moderne sans avoir à partir à l'autre bout du monde. Une
        nouvelle forme de{' '}
        <TextBold>
          tourisme local, ludique et rebelle, entre Histoire & Nature.
        </TextBold>
      </Text>
      <GapSeparator />
      <Text>
        Pour revaloriser nos régions, barouder, prendre le chemin buissonier,
        s'évader loin des villes et pourquoi pas{' '}
        <TextBold>rencontrer d'autres personnes de votre tribu.</TextBold>
      </Text>
      <GapSeparator />
      <GapSeparator />
      <Button onPress={() => router.push('/sign-in')} color="special">
        Connexion
      </Button>
      <Button onPress={() => router.push('/register')} fullWidth>
        Créer mon compte
      </Button>
      <GapSeparator />
      <TextLink
        onPress={() => router.push('/(app)/home')}
        color={Colors.label}
        align="center"
      >
        Visiter l'application en tant qu'invité
      </TextLink>
      <TextBoldLink
        onPress={() => ExpoLinking.openURL(`https://discord.gg/3PSaVmZrVB`)}
        align="center"
      >
        Accéder au Discord
      </TextBoldLink>
    </Screen>
  )
}
