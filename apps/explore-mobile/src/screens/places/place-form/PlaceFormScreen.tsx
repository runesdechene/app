import { useSession } from '@/hooks/use-session'
import {
  PresenterConfig,
  usePresenter,
} from '@/screens/places/place-form/use-presenter'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import {
  Button,
  ButtonPicto,
  Checkbox,
  DatePicker,
  DoubleInput,
  Flex,
  GapSeparator,
  ImageInput,
  Input,
  Loader,
  Picker,
  Screen,
  Text,
  Title,
} from '@ui'
import { SelectMapLocationScreen } from '../select-map-location/SelectMapLocationScreen'

export const PlaceFormScreen = (config: PresenterConfig) => {
  const {
    isEdition,
    placeTypes,
    form,
    isSubmittable,
    superCategory,
    fillWithCurrentLocation,
    fillFromMap,
    pickImages,
    deleteImage,
    isLoading,
    showMap,
    handleBackFromMap,
    handleNewPosition,
  } = usePresenter(config)
  const { session } = useSession()
  const { router } = useDependencies()

  if (isLoading) {
    return (
      <Screen
        backButton={{
          label: config.type === 'create' ? 'Nouveau lieu' : 'Mise à jour',
          onBackButton: () => router.back(),
        }}
      >
        <Loader />
      </Screen>
    )
  }

  if (showMap) {
    return (
      <SelectMapLocationScreen
        latitude={Number(form.values.latitude)}
        longitude={Number(form.values.longitude)}
        onBack={handleBackFromMap}
        onValidatePosition={handleNewPosition}
      />
    )
  }

  return (
    <Screen
      backButton={{
        label: config.type === 'create' ? 'Nouveau lieu' : 'Mise à jour',
        onBackButton: () => router.back(),
      }}
    >
      <Title size="h3">Sous-catégorie</Title>
      <Flex gap="M">
        {placeTypes?.map(placeType => (
          <>
            <ButtonPicto
              buttonType={superCategory?.images.local as any}
              key={placeType.id}
              size="S"
              active={placeType.id === form.values.placeTypeId}
              onPress={() => form.handleChange('placeTypeId')(placeType.id)}
            >
              {placeType.title}
            </ButtonPicto>
          </>
        ))}
      </Flex>
      <Input
        label="Nom"
        helper="Si le lieu n'en a pas, faites preuve d'imagination !"
        errorMessage={form.errors.title}
        value={form.values.title}
        placeholder="Mon super lieu"
        onChangeText={form.handleChange('title')}
      />
      <Input
        label="A propos"
        helper="Une description qui explique pourquoi ce lieu mérite de figurer dans les archives de la guilde"
        errorMessage={form.errors.text}
        value={form.values.text}
        onChangeText={form.handleChange('text')}
        multiline
        placeholder="Décrivez ce lieu avec vos mots"
      />
      <DoubleInput
        label="Coordonnées GPS"
        helper="Vous pouvez utiliser votre position actuelle pour remplir ce champ ou bien sélectionner un emplacement sur la carte du monde"
        errorMessageOne={form.errors.latitude}
        errorMessageTwo={form.errors.longitude}
        valueOne={form.values.latitude}
        valueTwo={form.values.longitude}
        onChangeTextOne={form.handleChange('latitude')}
        onChangeTextTwo={form.handleChange('longitude')}
        placeholderOne="Latitude"
        placeholderTwo="Longitude"
      />
      <Flex direction="row">
        <Button
          color="default"
          onPress={fillFromMap}
          style={{ flexGrow: 20, minWidth: '0%' }}
          size="S"
        >
          Ouvrir la carte
        </Button>
        <Button
          color="default"
          iconName="mapPin"
          onPress={fillWithCurrentLocation}
          style={{ flexGrow: 1, minWidth: '0%', height: '100%' }}
          size="S"
        />
      </Flex>
      <ImageInput
        label="Images"
        helper="Utilisez des images pour présenter le lieu de manière attrayante. Pas de visage."
        errorMessage={form.errors.images?.toString()}
        onAddPress={pickImages}
        onDeletePress={deleteImage}
        images={form.values.images}
      />
      <Checkbox
        title="Lieu sensible"
        value={form.values.sensible}
        onValueChange={value => {
          form.setFieldValue('sensible', value)
        }}
        label="Le lieu est-il sensible ?"
      />
      <Picker
        title="Lieu accessible"
        label="Quel est la difficulté d'accessibilité du lieu ?"
        value={form.values.accessibility ?? 'easy'}
        onChange={form.handleChange('accessibility')}
        items={[
          { label: 'Facile', value: 'easy' },
          { label: 'Moyen', value: 'medium' },
          { label: 'Difficile', value: 'hard' },
        ]}
      />
      {session?.user.role === 'admin' && superCategory?.hidden === true && (
        <>
          <GapSeparator />
          <GapSeparator separator />
          <GapSeparator />
          <Text>Règles pour bannière : 1200 * 300 pixels</Text>
          <GapSeparator />
          <DatePicker
            label="Date de début"
            value={form.values.beginAt}
            onChangeDate={value => {
              form.setFieldValue('beginAt', value)
            }}
          />
          <DatePicker
            label="Date de fin"
            value={form.values.endAt}
            onChangeDate={value => {
              form.setFieldValue('endAt', value)
            }}
          />
        </>
      )}

      <GapSeparator />
      <GapSeparator separator />
      <GapSeparator />
      <Button
        onPress={form.handleSubmit}
        disable={!isSubmittable || form.isSubmitting}
        color="primary"
      >
        {isEdition ? 'Mettre à jour' : 'Publier ce lieu'}
      </Button>
    </Screen>
  )
}
