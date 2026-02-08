import { useSession } from '@/hooks/use-session'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { ApiReview } from '@model'
import { useQueryClient } from '@tanstack/react-query'
import { useDrawer, useLoader, useModal, useSnackbar } from '@ui'

export const useReviewPresenter = ({
  review,
  isOwner,
  placeId,
}: {
  review: ApiReview
  isOwner: boolean
  placeId: string
}) => {
  async function onOptionsClick() {
    const canManage = isOwner || session?.user?.role === 'admin'

    const result = await drawer.show({
      options: canManage
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
      router.push(
        `/(other)/update-review?reviewId=${review.id}&placeId=${placeId}`,
      )
    } else if (result === 'delete') {
      return onDelete()
    }
  }

  async function onDelete() {
    const result = await modal.show({
      title: 'Supprimer',
      message:
        'Êtes-vous sûr de vouloir supprimer ce témoignage ? Cette action est irréversible.',
      options: [
        { key: 'cancel', title: 'Annuler' },
        { key: 'delete', title: 'Supprimer', type: 'danger' },
      ],
    })

    if (result === 'delete') {
      try {
        loader.show()
        await reviewsGateway.deleteReview({
          reviewId: review.id,
        })
        await queryClient.invalidateQueries({
          queryKey: ['place', placeId, 'reviews'],
        })

        loader.hide()
        snackbar.success('Témoignage supprimé')
      } catch (e) {
        snackbar.error(e)
      }
    }
  }

  const { session } = useSession()
  const queryClient = useQueryClient()
  const loader = useLoader()
  const snackbar = useSnackbar()
  const drawer = useDrawer()
  const modal = useModal()
  const { router, reviewsGateway } = useDependencies()

  return {
    onOptionsClick,
  }
}
