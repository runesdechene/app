import { Colors, Fonts, Radius, Sizes, Spacing } from '@/ui/constants'
import { KeyboardTypeOptions, Pressable } from 'react-native'
import styled from 'styled-components/native'
import { Flex } from './Flex'
import { IconContainer } from './IconContainer'
import { ImagesUploader, SelectedImage } from './ImagesUploader'
import { Text } from './Text'
import { Title } from './Title'

type InputProps = {
  label?: string
  helper?: string
  placeholder?: string
  errorMessage?: string
  keyboardType?: KeyboardTypeOptions
  secure?: boolean
  value?: string
  disable?: boolean
  multiline?: boolean
  onChangeText?: (text: string) => void
}

export const Input = ({
  label,
  helper,
  placeholder,
  errorMessage,
  keyboardType,
  secure,
  value,
  disable = false,
  multiline = false,
  onChangeText,
}: InputProps) => {
  return (
    <Flex gap="NONE">
      {label && <Title size="h3">{label}</Title>}
      {helper && <Text>{helper}</Text>}
      <TextInput
        value={value}
        disable={disable}
        onChangeText={onChangeText}
        secureTextEntry={!!secure}
        keyboardType={keyboardType}
        placeholder={placeholder}
        autoCapitalize="none"
        multiline={multiline}
      />
      {errorMessage && (
        <Text color={Colors.error} align="start">
          {errorMessage}
        </Text>
      )}
    </Flex>
  )
}

const TextInput = styled.TextInput<{ disable: boolean; multiline: boolean }>`
  border: ${({ disable }) =>
    Colors.input[disable ? 'disable' : 'default'].border};
  background-color: ${({ disable }) =>
    Colors.input[disable ? 'disable' : 'default'].background};
  padding: ${Spacing.padding.M}px;
  font-size: ${Sizes.text.M.size}px;
  font-family: ${Fonts.Text.Regular};
  min-width: 100%;
  border-radius: ${Radius.default}px;

  ${({ multiline }) =>
    multiline
      ? `vertical-align: top;min-height: ${6 * Sizes.text.M.lineHeight}px;`
      : ''}
`

type InputDoubleProps = {
  label?: string
  helper?: string
  placeholderOne?: string
  placeholderTwo?: string
  errorMessageOne?: string
  errorMessageTwo?: string
  valueOne?: string
  valueTwo?: string
  disableOne?: boolean
  disableTwo?: boolean
  onChangeTextOne?: (text: string) => void
  onChangeTextTwo?: (text: string) => void
}

export const DoubleInput = ({
  label,
  helper,
  placeholderOne,
  placeholderTwo,
  errorMessageOne,
  errorMessageTwo,
  valueOne,
  valueTwo,
  disableOne = false,
  disableTwo = false,
  onChangeTextOne,
  onChangeTextTwo,
}: InputDoubleProps) => {
  return (
    <Flex gap="NONE">
      {label && <Title size="h3">{label}</Title>}
      {helper && <Text>{helper}</Text>}
      <Flex gap="M" direction="row">
        <TextInput
          value={valueOne}
          disable={disableOne}
          onChangeText={onChangeTextOne}
          autoCapitalize="none"
          placeholder={placeholderOne}
          multiline={false}
          style={{ minWidth: '0%', flexGrow: 1 }}
        />
        <TextInput
          value={valueTwo}
          disable={disableTwo}
          onChangeText={onChangeTextTwo}
          placeholder={placeholderTwo}
          autoCapitalize="none"
          multiline={false}
          style={{ minWidth: '0%', flexGrow: 1 }}
        />
      </Flex>
      {errorMessageOne && <Text color={Colors.error}>{errorMessageOne}</Text>}
      {errorMessageTwo && <Text color={Colors.error}>{errorMessageTwo}</Text>}
    </Flex>
  )
}

type ImageInputProps = {
  label?: string
  helper?: string
  errorMessage?: string
  images?: SelectedImage[]
  onAddPress: () => void
  onDeletePress: (id: string) => void
}

export const ImageInput = ({
  label,
  helper,
  errorMessage,
  images,
  onAddPress,
  onDeletePress,
}: ImageInputProps) => {
  return (
    <Flex gap="NONE">
      {label && <Title size="h3">{label}</Title>}
      {helper && <Text>{helper}</Text>}
      <ImagesUploader
        onAddPress={onAddPress}
        images={images ?? []}
        onDelete={onDeletePress}
      />
      {errorMessage && <Text color={Colors.error}>{errorMessage}</Text>}
    </Flex>
  )
}

type RateInputProps = {
  label?: string
  helper?: string
  errorMessage?: string
  value?: number
  onChangeRate: (newRate: number) => void
}

export const rateArray = [1, 2, 3, 4, 5]

export const RateInput = ({
  label,
  helper,
  errorMessage,
  value,
  onChangeRate,
}: RateInputProps) => {
  return (
    <Flex gap="NONE">
      {label && <Title size="h3">{label}</Title>}
      {helper && <Text>{helper}</Text>}
      <Flex gap="M" direction="row">
        {rateArray.map(rate => {
          const isHighlighted = (value ?? 0) >= rate
          return (
            <Pressable onPress={() => onChangeRate(rate)} key={rate}>
              <IconContainer
                name={isHighlighted ? 'starFill' : 'star'}
                color={isHighlighted ? Colors.yellow : Colors.label}
                size="L"
              />
            </Pressable>
          )
        })}
      </Flex>
      {errorMessage && <Text color={Colors.error}>{errorMessage}</Text>}
    </Flex>
  )
}
