import { Loader } from './Loader'
import { Text } from './Text'

export const EmptyListView = ({ isLoading }: { isLoading: boolean }) => {
  return (
    <>{isLoading ? <Loader size="small" /> : <Text>Aucun lieu trouvé</Text>}</>
  )
}
