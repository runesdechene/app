import { useSession } from '@/hooks/use-session'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import {
  Colors,
  Flex,
  GapSeparator,
  Screen,
  Text,
  TextLink,
  useSnackbar,
} from '@ui'
import * as ExpoLinking from 'expo-linking'
import { Href } from 'expo-router'

export const SettingsHomeScreen = () => {
  const createRouter = (url: Href) => () => router.push(url)

  const { signOut, session, isAuthenticated } = useSession()
  const { router, storage, appVersion } = useDependencies()
  const snackbar = useSnackbar()

  const cleaning = () => {
    storage.removeItem('@app_version')
    snackbar.success('Nettoyage fait')
  }

  return (
    <Screen
      backButton={{
        label: 'Paramètres',
        onBackButton: () => router.push('/profile'),
      }}
    >
      <Flex direction="column" gap="XL">
        <TextLink
          onPress={createRouter('/settings/change-informations')}
          color={Colors.label}
        >
          Modifier mon Profil
        </TextLink>
        <TextLink
          onPress={createRouter('/settings/change-email-address')}
          color={Colors.label}
        >
          Adresse e-mail
        </TextLink>
        <TextLink
          onPress={createRouter('/settings/change-password')}
          color={Colors.label}
        >
          Mot de passe
        </TextLink>
        <GapSeparator separator />
        <TextLink
          onPress={createRouter('/settings/sensible-place')}
          color={Colors.label}
        >
          Charte des lieux sensibles
        </TextLink>
        <GapSeparator separator />
        {isAuthenticated && session?.user?.role === 'admin' && (
          <>
            <TextLink
              onPress={createRouter('/settings/admin-stats')}
              color={Colors.label}
            >
              Statistiques
            </TextLink>
            <TextLink
              onPress={createRouter('/settings/admin-events')}
              color={Colors.label}
            >
              Evênements & festivals
            </TextLink>
            <GapSeparator separator />
          </>
        )}
        <TextLink
          onPress={createRouter('/settings/about')}
          color={Colors.label}
        >
          A propos
        </TextLink>
        <TextLink
          onPress={() => {
            ExpoLinking.openURL('mailto:tech@guildedesvoyageurs.fr')
          }}
          color={Colors.label}
        >
          Signaler un problème
        </TextLink>
        <TextLink
          onPress={createRouter('/settings/delete-account')}
          color={Colors.label}
        >
          Supprimer mon compte
        </TextLink>
        <TextLink
          onPress={async () => {
            await signOut()
            router.resetTo('/')
          }}
          color={Colors.label}
        >
          Déconnexion
        </TextLink>
        <Text>{`Version : ${appVersion}`}</Text>
        {isAuthenticated && session?.user?.role === 'admin' && (
          <>
            <GapSeparator separator />
            <TextLink onPress={cleaning} color={Colors.label}>
              Nettoyage
            </TextLink>
          </>
        )}
      </Flex>
    </Screen>
  )
}
