import { FC, PropsWithChildren } from 'react'
import { Flex } from './Flex'

/**
 * @deprecated
 */
export const ScreenContainer: FC<PropsWithChildren> = ({ children }) => {
  return <Flex gap={'L'}>{children}</Flex>
}
