import { useSession } from '@/hooks/use-session'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useMutation } from '@tanstack/react-query'
import { Button, Screen, Text, useModal, useSnackbar } from '@ui'

export const DeleteAccountScreen = () => {
  const modal = useModal()
  const session = useSession()
  const snackbar = useSnackbar()
  const { router, accountGateway } = useDependencies()

  async function showModal() {
    const result = await modal.show({
      title: 'Supprimer',
      message:
        'Vous êtes sur le point de supprimer votre compte. Cette action est irreversible.',
      options: [
        { key: 'cancel', title: 'Annuler' },
        { key: 'delete', title: 'Supprimer définitivement', type: 'danger' },
      ],
    })

    if (result === 'delete') {
      mutation.mutate()
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      return accountGateway.deleteAccount()
    },
    onSuccess: async () => {
      snackbar.success('Votre compte a été supprimé avec succès')
      await session.signOut()
      router.resetTo('/')
    },
    onError: error => {
      snackbar.error(error)
    },
  })
  return (
    <Screen
      backButton={{
        label: 'Supprimer mon compte',
        onBackButton: () => router.back(),
      }}
    >
      <Text>Êtes-vous sûr de vouloir supprimer votre compte ?</Text>
      <Text>
        En cliquant sur le bouton "Supprimer", votre compte sera définitivement
        détruit.
      </Text>
      <Text>Cette action est irreversible.</Text>
      <Button onPress={showModal} disable={mutation.isPending} color="primary">
        Supprimer définitivement
      </Button>
    </Screen>
  )
}
