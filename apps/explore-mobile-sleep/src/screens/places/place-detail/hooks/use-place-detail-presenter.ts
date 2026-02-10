import { useSession } from '@/hooks/use-session'
import {
  bookmarkPlaceAction,
  explorePlaceAction,
  likePlaceAction,
  unBookmarkPlaceAction,
  unExplorePlaceAction,
  unLikePlaceAction,
} from '@/store/place-actions'
import { useAppDispatch, useAppSelector } from '@/store/store'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { IPlacesCommandGateway } from '@ports'
import { useQueryClient } from '@tanstack/react-query'
import { useDrawer, useLoader, useModal, useSnackbar } from '@ui'

export const usePlaceDetailPresenter = ({ placeId }: { placeId: string }) => {
  function createMethod({
    action,
    compensation,
    method,
  }: {
    action: any
    compensation: any
    method: keyof IPlacesCommandGateway
  }) {
    return async () => {
      dispatch(action({ placeId: place.id }))
      try {
        // @ts-ignore
        await placesCommandGateway[method](place.id)
      } catch (e) {
        dispatch(compensation({ placeId: place.id }))
        snackbar.error(e)
        throw e
      }
    }
  }

  async function onOptionsClick() {
    const result = await drawer.show({
      options: canAdministrate
        ? [
            {
              key: 'update',
              title: 'Modifier',
              icon: 'edit',
            },
            {
              key: 'delete',
              title: 'Supprimer',
              icon: 'trash',
            },
            {
              key: 'report',
              title: 'Signaler',
              icon: 'signal',
            },
          ]
        : [
            {
              key: 'report',
              title: 'Signaler',
              icon: 'signal',
            },
          ],
    })

    if (!result) {
      return
    }

    if (result === 'update') {
      router.push(`/(other)/update-place?placeId=${place.id}`)
    } else if (result === 'delete') {
      return onDelete()
    }
  }

  async function onDelete() {
    const result = await modal.show({
      title: 'Supprimer',
      message:
        'Êtes-vous sûr de vouloir supprimer ce lieu ? Cette action est irréversible.',
      options: [
        { key: 'cancel', title: 'Annuler' },
        { key: 'delete', title: 'Supprimer', type: 'danger' },
      ],
    })

    if (result === 'delete') {
      try {
        loader.show()
        await placesCommandGateway.deletePlace(place.id)
        await queryClient.invalidateQueries({
          predicate: query => {
            return (
              query.queryKey.includes('user-places') ||
              query.queryKey.includes('regular-feed')
            )
          },
        })

        loader.hide()
        router.back()
      } catch (e) {
        snackbar.error(e)
      }
    }
  }

  async function onProfileClick() {
    router.push(`/(other)/user-profile?userId=${place.author.id}`)
  }

  const dispatch = useAppDispatch()
  const place = useAppSelector(state => state.placeDetails.places[placeId])

  const { placesCommandGateway, router } = useDependencies()
  const snackbar = useSnackbar()
  const drawer = useDrawer()
  const modal = useModal()
  const { session } = useSession()
  const queryClient = useQueryClient()
  const loader = useLoader()

  const canAdministrate =
    session?.user?.role === 'admin' || session?.user.id === place.author.id

  return {
    place,
    like: createMethod({
      action: likePlaceAction,
      compensation: unLikePlaceAction,
      method: 'likePlace',
    }),
    removeLike: createMethod({
      action: unLikePlaceAction,
      compensation: likePlaceAction,
      method: 'removeLikePlace',
    }),
    explore: createMethod({
      action: explorePlaceAction,
      compensation: unExplorePlaceAction,
      method: 'explorePlace',
    }),
    removeExplore: createMethod({
      action: unExplorePlaceAction,
      compensation: explorePlaceAction,
      method: 'removeExplorePlace',
    }),
    bookmark: createMethod({
      action: bookmarkPlaceAction,
      compensation: unBookmarkPlaceAction,
      method: 'bookmarkPlace',
    }),
    removeBookmark: createMethod({
      action: unBookmarkPlaceAction,
      compensation: bookmarkPlaceAction,
      method: 'removeBookmarkPlace',
    }),
    onOptionsClick,
    onProfileClick,
  }
}
