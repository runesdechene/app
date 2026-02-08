import React, { FC, PropsWithChildren } from 'react'
import styled from 'styled-components/native'
import { ButtonColors, Colors, Radius, Spacing } from '../constants/Styles'
import { Flex } from './Flex'
import { Title } from './Title'

export type TagProps = {
  color?: ButtonColors
}
export const Tag: FC<PropsWithChildren<TagProps>> = ({
  color = 'default',
  children,
}) => {
  return (
    <TagContainer color={color}>
      <TagSpacer>
        <Flex gap="NONE" direction="row" center>
          {children && (
            <Title color={Colors.tag.text} size="h4">
              {children}
            </Title>
          )}
        </Flex>
      </TagSpacer>
    </TagContainer>
  )
}

const TagContainer = styled.Pressable<{
  color: ButtonColors
}>`
  background-color: ${Colors.tag.background};
  border-radius: ${Radius.round}px;
`

const TagSpacer = styled.View`
  padding-top: 0;
  padding-bottom: 0;
  padding-left: ${Spacing.padding.S}px;
  padding-right: ${Spacing.padding.S}px;
  background-color: transparent;
`
