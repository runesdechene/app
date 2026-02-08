import { useDependencies } from '@/ui/dependencies/Dependencies'
import { Button, Checkbox, ImageInput, Input, RateInput, Screen } from '@ui'
import { PresenterConfig, usePresenter } from './hooks/use-presenter'

export const ReviewFormScreen = (config: PresenterConfig) => {
  const { isEdition, form, isSubmittable, pickImages, deleteImage } =
    usePresenter(config)

  const { router } = useDependencies()
  return (
    <Screen
      backButton={{ label: 'commentaire', onBackButton: () => router.back() }}
    >
      <Input
        label="Votre expérience"
        helper="Faites un retour de ce lieu, de ce qui vous a plus, de ce qu’il est bon de savoir, du géocache que vous avez trouvé/caché."
        placeholder="Décrivez votre expérience"
        onChangeText={form.handleChange('message')}
        multiline
        errorMessage={form.errors.message}
        value={form.values.message}
      />
      <RateInput
        label="Note"
        helper="Combien d'étoiles donnez vous à cet endroit ?"
        errorMessage={form.errors.score}
        value={form.values.score}
        onChangeRate={value => form.setFieldValue('score', value)}
      />
      <ImageInput
        label="Images"
        helper="Utilisez des images pour illustrer votre expérience de ce lieu."
        errorMessage={form.errors.images?.toString()}
        onAddPress={pickImages}
        images={form.values.images}
        onDeletePress={deleteImage}
      />
      <Checkbox
        title="Géocache"
        value={form.values.geocache}
        onValueChange={value => {
          form.setFieldValue('geocache', value)
        }}
        label="Avez-vous trouvé/placé une géocache ?"
      />
      <Button
        onPress={() => {
          form.handleSubmit()
        }}
        disable={!isSubmittable || form.isSubmitting}
        color="primary"
      >
        {isEdition ? 'Mettre à jour' : 'Publier ce témoignage'}
      </Button>
    </Screen>
  )
}
