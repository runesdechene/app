import {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { Colors } from '../constants'
import { Button } from './Button'
import { Flex } from './Flex'
import { Text } from './Text'
import { Title } from './Title'

type InputProps = {
  label?: string
  helper?: string
  errorMessage?: string
  value: Date | null
  onChangeDate?: (date: Date) => void
}

export const DatePicker = ({
  label,
  helper,
  errorMessage,
  value,
  onChangeDate,
}: InputProps) => {
  const [date, setDate] = useState<Date | null>(value)

  const onChange = (event: DateTimePickerEvent, date?: Date | undefined) => {
    if (date) {
      setDate(date)
      onChangeDate?.(date)
    }
  }

  const showDatepicker = () => {
    const dateFormatted = new Date()
    dateFormatted.setHours(1, 0, 0, 0)
    DateTimePickerAndroid.open({
      value: date ?? dateFormatted,
      onChange,
      mode: 'date',
      is24Hour: true,
    })
  }

  return (
    <Flex gap="NONE">
      {label && <Title size="h3">{label}</Title>}
      {helper && <Text>{helper}</Text>}
      <Flex direction="row">
        <Text style={{ flexGrow: 20, minWidth: '0%' }}>
          {date ? date.toLocaleString() : 'INDEFINI'}
        </Text>
        <Button
          color="default"
          iconName="compass"
          onPress={showDatepicker}
          style={{ flexGrow: 1, minWidth: '0%', height: '100%' }}
          size="S"
        />
      </Flex>
      {errorMessage && (
        <Text color={Colors.error} align="start">
          {errorMessage}
        </Text>
      )}
    </Flex>
  )
}
