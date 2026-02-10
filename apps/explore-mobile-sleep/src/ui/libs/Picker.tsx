import React, { FC, PropsWithChildren, useEffect, useState } from 'react'
import DropDownPicker from 'react-native-dropdown-picker'
import { Colors, Fonts, Radius, Sizes } from '../constants'
import { Flex } from './Flex'
import { Text } from './Text'
import { Title } from './Title'

type Props = {
  label?: string
  value: string
  title: string
  items: {
    label: string
    value: string
  }[]
  onChange?: (value: string) => void
}

export const Picker: FC<PropsWithChildren<Props>> = ({
  label,
  value,
  items,
  title,
  onChange,
}) => {
  const [open, setOpen] = useState(false)
  const [currentValue, setCurrentValue] = useState(value)

  useEffect(() => {
    if (currentValue && onChange && currentValue !== value) {
      onChange(currentValue)
    }
  }, [value, currentValue, onChange])
  return (
    <Flex direction="column" gap="NONE">
      <Title size="h3">{title}</Title>
      {label && <Text>{label}</Text>}
      <DropDownPicker
        open={open}
        value={currentValue}
        items={items}
        setOpen={setOpen}
        setValue={setCurrentValue}
        textStyle={{
          fontFamily: Fonts.Text.Regular,
          fontSize: Sizes.text.M.size,
          color: Colors.input.default.text,
          backgroundColor: Colors.input.default.background,
          borderColor: Colors.input.default.borderColor,
        }}
        style={{
          borderColor: Colors.input.default.borderColor,
          borderRadius: Radius.default,
          backgroundColor: Colors.input.default.background,
        }}
        dropDownContainerStyle={{
          backgroundColor: Colors.input.default.background,
          borderColor: Colors.input.default.borderColor,
          borderRadius: Radius.default,
        }}
      />
    </Flex>
  )
}
