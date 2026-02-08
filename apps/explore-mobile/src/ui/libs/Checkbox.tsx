import { Checkbox as ExpoCheckbox } from 'expo-checkbox'
import { Colors, Spacing } from '../constants'
import { Flex } from './Flex'
import { Text } from './Text'
import { Title } from './Title'

type CheckboxProps = {
  title?: string
  value: boolean
  label: string
  onValueChange: (newVal: boolean) => void
}

export const Checkbox = ({
  value,
  onValueChange,
  label,
  title,
}: CheckboxProps) => {
  return (
    <Flex direction="column" gap="XS">
      {title && <Title size="h3">{title}</Title>}
      <Flex direction="row" gap="L">
        <ExpoCheckbox
          value={value}
          onValueChange={onValueChange}
          style={{
            borderRadius: 8,
            borderColor: Colors.label,
            borderWidth: 1,
            padding: Spacing.padding.S,
          }}
          color={Colors.button.primary.background.default}
        />
        <Text>{label}</Text>
      </Flex>
    </Flex>
  )
}
