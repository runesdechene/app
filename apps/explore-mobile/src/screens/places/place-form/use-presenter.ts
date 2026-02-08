import { useSession } from '@/hooks/use-session'
import { useAdminChildrenPlaceTypesQuery } from '@/queries/use-admin-children-place-types-query'
import { useChildrenPlaceTypesQuery } from '@/queries/use-children-place-types-query'
import { useDependencies } from '@/ui/dependencies/Dependencies'
import { ApiPlaceDetail } from '@model'
import { useQueryClient } from '@tanstack/react-query'
import { useLocationProvider, useSnackbar } from '@ui'
import { useFormik } from 'formik'
import { useState } from 'react'
import z from 'zod'
import { toFormikValidationSchema } from 'zod-formik-adapter'

const validator = z.object({
  placeTypeId: z.string(),
  title: z
    .string({ message: 'Titre requis' })
    .min(5, 'Au moins 5 caractères')
    .max(100, 'Moins de 100 caractères'),
  text: z
    .string({ message: 'Description requise' })
    .min(25, 'Au moins 25 caractères')
    .max(2500, 'Moins de 2500 caractères'),
  latitude: z.string({ message: 'Latitude requise' }),
  longitude: z.string({ message: 'Longitude requise' }),
  private: z.boolean().default(false),
  sensible: z.boolean().default(false),
  accessibility: z.enum(['easy', 'medium', 'hard']).nullable(),
  images: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
        status: z.enum(['pending', 'uploaded']),
      }),
    )
    .min(1, 'Au moins une image'),
  beginAt: z.date().nullable(),
  endAt: z.date().nullable(),
})

type FormType = z.infer<typeof validator>
const initialForm: FormType = {
  placeTypeId: '',
  title: '',
  text: '',
  latitude: '',
  longitude: '',
  private: false,
  images: [],
  accessibility: 'easy',
  sensible: false,
  beginAt: null,
  endAt: null,
}

export type PresenterConfig =
  | { type: 'create'; placeTypeId: string }
  | { type: 'update'; place: ApiPlaceDetail }

export const usePresenter = (config: PresenterConfig) => {
  const { location } = useLocationProvider()
  const { session } = useSession()
  const [showMap, setShowMap] = useState(false)

  async function submit(values: FormType) {
    const payload = {
      placeTypeId: values.placeTypeId,
      title: values.title,
      text: values.text,
      location: {
        latitude: parseFloat(values.latitude),
        longitude: parseFloat(values.longitude),
      },
      private: values.private,
      images: values.images.map(image => ({
        id: image.id,
        url: image.url,
      })),
      accessibility: values.accessibility,
      sensible: values.sensible,
      beginAt:
        session?.user.role === 'admin' && values.beginAt?.toISOString()
          ? values.beginAt
          : null,
      endAt:
        session?.user.role === 'admin' && values.endAt?.toISOString()
          ? values.endAt
          : null,
    }
    if (config.type === 'create') {
      try {
        const result = await placesCommandGateway.createPlace(payload)

        router.replace(`/place-detail?placeId=${result.id}`)
      } catch (e) {
        snackbar.error(e)
      }
    } else {
      try {
        await placesCommandGateway.updatePlace({
          ...payload,
          id: config.place.id,
        })

        await queryClient.invalidateQueries({
          predicate: query => {
            const parts = query.queryKey.join('|')

            return (
              query.queryKey.includes('user-places') ||
              query.queryKey.includes('regular-feed') ||
              parts.startsWith('place|' + config.place.id)
            )
          },
        })
        snackbar.success('Lieu mis à jour')
        router.replace(`/place-detail?placeId=${config.place.id}`)
      } catch (e) {
        snackbar.error(e)
      }
    }
  }

  function createForm(config: PresenterConfig): FormType {
    if (config.type === 'create') {
      return {
        ...initialForm,
        latitude: location?.latitude.toString() ?? '',
        longitude: location?.longitude.toString() ?? '',
      }
    } else {
      const place = config.place
      return {
        placeTypeId: place.type.id,
        title: place.title,
        text: place.text,
        latitude: place.location.latitude.toString(),
        longitude: place.location.longitude.toString(),
        private: false,
        images: place.images.map(image => ({
          id: image.id,
          url: image.url,
          status: 'uploaded',
        })),
        sensible: place.sensible,
        accessibility: place.accessibility,
        beginAt: place.beginAt ? new Date(place.beginAt) : null,
        endAt: place.endAt ? new Date(place.endAt) : null,
      }
    }
  }
  const placeTypeId =
    config.type === 'create' ? config.placeTypeId : config.place.type.id
  const snackbar = useSnackbar()
  const {
    router,
    eventEmitter,
    imageSelector,
    locationService,
    placesCommandGateway,
  } = useDependencies()
  const queryClient = useQueryClient()

  const form = useFormik({
    initialValues: {
      ...createForm(config),
      placeTypeId,
    },
    onSubmit: submit,
    validationSchema: toFormikValidationSchema(validator),
  })

  const placeTypes = useChildrenPlaceTypesQuery({ parentId: placeTypeId })
  const adminPlaceTypes = useAdminChildrenPlaceTypesQuery({
    parentId: placeTypeId,
  })

  const mergedPlaceTypes = [
    ...(placeTypes.data ?? []),
    ...(adminPlaceTypes.data ?? []),
  ]
  /*useEffect(() => {
    const listener = eventEmitter.on('map-location-selected', e => {
      form.setValues({
        ...form.values,
        latitude: (e.latitude as number).toPrecision(10),
        longitude: (e.longitude as number).toPrecision(10),
      })
    })

    return () => {
      listener.remove()
    }
  }, [])*/

  const handleBackFromMap = () => {
    setShowMap(false)
  }

  const handleNewPosition = (latitude: number, longitude: number) => {
    form.setValues({
      ...form.values,
      latitude: latitude.toPrecision(10),
      longitude: longitude.toPrecision(10),
    })
    setShowMap(false)
  }

  return {
    isEdition: config.type === 'update',
    superCategory: mergedPlaceTypes?.find(x => x.id === placeTypeId),
    placeTypes: mergedPlaceTypes,
    form,
    isSubmittable: form.values.images.every(
      image => image.status === 'uploaded',
    ),
    fillWithCurrentLocation: async () => {
      const location = await locationService.acquireLocation()
      if (location) {
        form.setValues({
          ...form.values,
          latitude: (location.latitude as number).toPrecision(8),
          longitude: (location.longitude as number).toPrecision(8),
        })
      }
    },
    fillFromMap: () => {
      setShowMap(true)
    },
    pickImages: async () => {
      await imageSelector.pickMany({
        onSelected: medias => {
          return form.setValues(values => ({
            ...values,
            images: [
              ...form.values.images,
              ...medias.map(asset => ({
                id: asset.id,
                url: asset.url,
                status: 'pending' as const,
              })),
            ],
          }))
        },
        onUploaded: ({ id, url }) => {
          return form.setValues(values => ({
            ...values,
            images: values.images.map(image =>
              image.id === id
                ? { ...image, url, status: 'uploaded' as const }
                : image,
            ),
          }))
        },
        onFailed: id => {
          return form.setValues(values => ({
            ...values,
            images: values.images.filter(image => image.id !== id),
          }))
        },
      })
    },
    deleteImage: (id: string) => {
      form.setValues({
        ...form.values,
        images: form.values.images.filter(image => image.id !== id),
      })
    },
    isLoading: placeTypes.isLoading || adminPlaceTypes.isLoading,
    showMap,
    handleBackFromMap,
    handleNewPosition,
  }
}
