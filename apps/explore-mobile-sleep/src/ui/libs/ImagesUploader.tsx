import { Colors, Radius, Spacing } from '@/ui/constants'
import styled from 'styled-components/native'
import { IconContainer } from './IconContainer'
import { ImagesList } from './ImagesList'

export type SelectedImage = {
  id: string
  url: string
  status: 'pending' | 'uploaded'
}

export const ImagesUploader = ({
  onAddPress,
  images,
  onDelete,
}: {
  onAddPress: () => void
  images: SelectedImage[]
  onDelete: (id: string) => void
}) => {
  return (
    <ImagesList
      footer={
        <ButtonPressableContainer onPress={onAddPress}>
          <IconContainer name="plus" size="L" color={Colors.label} />
        </ButtonPressableContainer>
      }
      images={images}
      actionButton={{ action: id => onDelete(id), iconName: 'trash' }}
    />
  )
}

const ButtonPressableContainer = styled.Pressable`
  background-color: ${Colors.superBackground};
  padding: ${Spacing.padding.M}px;
  border: 1px dashed ${Colors.label};
  border-radius: ${Radius.default}px;
  align-items: center;
  margin-top: ${Spacing.gap.M}px;
`
