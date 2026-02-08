import { placeTypeService } from '@services'
import React, { FC, PropsWithChildren } from 'react'
import {
  ButtonColors,
  ButtonPictoType,
  Colors,
  Opacity,
} from '../constants/Styles'
import { Button, ButtonProps } from './Button'
import { PlaceTypeIconContainer } from './PlaceTypeIconContainer'

type ButtonPictoProps = ButtonProps & {
  buttonType: ButtonPictoType
}
export const ButtonPicto: FC<PropsWithChildren<ButtonPictoProps>> = ({
  buttonType,
  ...rest
}) => {
  const colorButton = Colors.buttonPicto[buttonType]?.color as ButtonColors

  return (
    <Button
      color={colorButton}
      forceBackgroundImg={
        rest.active
          ? placeTypeService.getImage(buttonType, 'background')
          : undefined
      }
      style={{
        opacity: rest.active ? Opacity.normal : Opacity.disable,
      }}
      forcePictoImg={
        <PlaceTypeIconContainer
          placeTypeName={buttonType}
          placeTypeSize="map_mini"
        />
      }
      center={false}
      {...rest}
    />
  )
}
