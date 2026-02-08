import { Colors, Spacing } from '@/ui/constants'
import { Loader, Text } from '@/ui/libs'
import { ReactElement } from 'react'
import { FlatList, StyleProp, ViewStyle } from 'react-native'
import styled from 'styled-components/native'

const EmptyListView = ({
  isLoading,
  emptyText,
}: {
  isLoading: boolean
  emptyText?: string
}) => {
  return (
    <Container>
      {isLoading ? (
        <Loader />
      ) : (
        <Text>{emptyText ?? "Rien n'est à afficher"}</Text>
      )}
    </Container>
  )
}

const Container = styled.View`
  height: 150px;

  background-color: ${Colors.background};
  border-radius: 5px;

  display: flex;
  justify-content: center;
  align-items: center;
`

type FlatListWrapperType<T> = {
  query: {
    data: T[]
    isFetching: boolean
    refetch: () => void
    fetchNextPage: () => void
  }
  itemRender: (item: T, index: number) => ReactElement
  listHeaderComponent?: ReactElement
  listFooterComponent?: ReactElement
  paddingList?: boolean
  containerStyle?: StyleProp<ViewStyle>
}

export const FlatListWrapper = <T extends { id: string }>(
  props: FlatListWrapperType<T>,
) => {
  return (
    <FlatList
      numColumns={2}
      keyExtractor={(item: T) => item.id}
      data={props.query.data}
      refreshing={props.query.isFetching}
      onRefresh={props.query.refetch}
      onEndReached={props.query.fetchNextPage}
      onEndReachedThreshold={0.7}
      columnWrapperStyle={{ gap: Spacing.gap.L }}
      ListHeaderComponent={props.listHeaderComponent}
      ListFooterComponent={props.listFooterComponent}
      ListEmptyComponent={<EmptyListView isLoading={props.query.isFetching} />}
      renderItem={({ item, index }: { item: T; index: number }) =>
        props.itemRender(item, index)
      }
      contentContainerStyle={[
        {
          justifyContent: 'space-between',
          gap: Spacing.gap.L,
          marginBottom: 500,
        },
        props.containerStyle,
      ]}
    />
  )
}
