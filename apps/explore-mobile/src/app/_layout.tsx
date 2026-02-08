import { QueryProvider } from '@/core/query-client'
import { SessionProvider, useSession } from '@/hooks/use-session'
import {
  DependenciesProvider,
  useDependencies,
} from '@/ui/dependencies/Dependencies'
import { ThemeProvider } from '@react-navigation/native'
import {
  AppTheme,
  DrawerProvider,
  LoaderProvider,
  LocationProvider,
  ModalProvider,
  SnackbarProvider,
} from '@ui'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import * as Updates from 'expo-updates'
import { useEffect } from 'react'
import { PaperProvider } from 'react-native-paper'
import 'react-native-reanimated'

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

async function checkForOTAUpdate() {
  if (__DEV__) return
  try {
    const update = await Updates.checkForUpdateAsync()
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync()
      await Updates.reloadAsync()
    }
  } catch (e) {
    console.warn('OTA update check failed:', e)
  }
}

export default function RootLayout() {
  useEffect(() => {
    checkForOTAUpdate()
  }, [])

  const [loaded] = useFonts({
    // Inconsolata
    Inconsolata_Black: require('@/ui/assets/fonts/Inconsolata-Black.ttf'),
    Inconsolata_Bold: require('@/ui/assets/fonts/Inconsolata-Bold.ttf'),
    Inconsolata_ExtraBold: require('@/ui/assets/fonts/Inconsolata-ExtraBold.ttf'),
    Inconsolata_ExtraLight: require('@/ui/assets/fonts/Inconsolata-ExtraLight.ttf'),
    Inconsolata_Light: require('@/ui/assets/fonts/Inconsolata-Light.ttf'),
    Inconsolata_Medium: require('@/ui/assets/fonts/Inconsolata-Medium.ttf'),
    Inconsolata_Regular: require('@/ui/assets/fonts/Inconsolata-Regular.ttf'),
    Inconsolata_SemiBold: require('@/ui/assets/fonts/Inconsolata-SemiBold.ttf'),

    // BebasNeue
    BebasNeue_Regular: require('@/ui/assets/fonts/BebasNeue-Regular.ttf'),
  })

  if (!loaded) {
    return null
  }

  return (
    <DependenciesProvider>
      <QueryProvider>
        <App />
      </QueryProvider>
    </DependenciesProvider>
  )
}

export const App = () => {
  return (
    <ThemeProvider value={AppTheme}>
      <PaperProvider>
        <SessionProvider>
          <LocationProvider>
            <LoaderProvider>
              <SnackbarProvider>
                <DrawerProvider>
                  <ModalProvider>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                      }}
                    />
                  </ModalProvider>
                </DrawerProvider>
              </SnackbarProvider>
            </LoaderProvider>

            <Loader />
          </LocationProvider>
        </SessionProvider>
      </PaperProvider>
    </ThemeProvider>
  )
}

const Loader = () => {
  const { router } = useDependencies()
  const session = useSession()

  useEffect(() => {
    if (!session.ready) {
      return
    }

    if (session.isAuthenticated) {
      router.replace('/(app)/home')

      // Courtesy layout to allow the animation to complete
      // and avoid the flickering effect.

      setTimeout(() => SplashScreen.hideAsync(), 500)
    } else {
      SplashScreen.hideAsync()
    }
  }, [session.ready])

  return null
}
