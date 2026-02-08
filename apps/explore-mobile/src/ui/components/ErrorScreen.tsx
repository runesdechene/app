import { HttpException } from '@/shared/http/http-exception'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { Screen } from '@/ui/libs/Screen/Screen'
import { Text } from '@/ui/libs/Text'
import styled from 'styled-components/native'

export function printError(value: any) {
  if (value instanceof HttpException) {
    return value.message
  }

  return "Une erreur s'est produite."
}

export const ErrorScreen = ({ children }: { children: any }) => {
  const { router } = useDependencies()
  return (
    <Screen backButton={{ label: 'Erreur', onBackButton: () => router.back() }}>
      <Content>
        <Text>{printError(children)}</Text>
      </Content>
    </Screen>
  )
}

const Content = styled.SafeAreaView`
  margin: 100px 0;
`
