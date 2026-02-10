import { FC, PropsWithChildren } from 'react'
import styled from 'styled-components/native'
import { Spacing } from '../constants'
import { Text } from './Text'

type Props = {
  label: string
  value?: boolean
  onChange?: (value: boolean) => void
}

export const Switch: FC<PropsWithChildren<Props>> = ({
  label,
  value,
  onChange,
}) => {
  return (
    <SwitchContainer>
      <Text>{label}</Text>
      <SwitchStyled value={value} onValueChange={onChange} />
    </SwitchContainer>
  )
}

const SwitchContainer = styled.View`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${Spacing.gap.M}px;
`

const SwitchStyled = styled.Switch``
