import { Link, Stack } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { Text, Title } from '@ui'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Title>Cette page n'existe pas.</Title>
        <Link href="/" style={styles.link}>
          <Text>Retourner à la page d'accueil</Text>
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
})
