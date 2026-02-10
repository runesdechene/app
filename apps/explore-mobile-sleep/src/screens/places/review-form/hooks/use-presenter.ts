import { useDependencies } from '@/ui/dependencies/Dependencies'
import { ApiReview } from '@model'
import { useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from '@ui'
import { useFormik } from 'formik'
import z from 'zod'
import { toFormikValidationSchema } from 'zod-formik-adapter'

const validator = z.object({
  score: z.number({ message: 'Score requis' }).min(1).max(5),
  message: z
    .string({ message: 'Description requise' })
    .min(25, 'Au moins 25 caractères')
    .max(2500, 'Moins de 2500 caractères'),
  images: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      status: z.enum(['pending', 'uploaded']),
    }),
  ),
  geocache: z.boolean(),
})

type FormType = z.infer<typeof validator>
const initialForm: FormType = {
  score: 3,
  message: '',
  images: [],
  geocache: false,
}

export type PresenterConfig =
  | { type: 'create'; placeId: string }
  | { type: 'update'; review: ApiReview; placeId: string }

export const usePresenter = (config: PresenterConfig) => {
  async function submit(values: FormType) {
    if (config.type === 'create') {
      await reviewsGateway.createReview({
        placeId: config.placeId,
        score: values.score,
        message: values.message,
        imagesIds: values.images.map(image => image.id),
        geocache: values.geocache,
      })

      snackbar.success('Témoignage créé')
      router.back()
    } else {
      await reviewsGateway
        .updateReview({
          reviewId: config.review.id,
          score: values.score,
          message: values.message,
          imagesIds: values.images.map(image => image.id),
          geocache: values.geocache,
        })
        .catch(e => {
          console.error(e)
        })

      snackbar.success('Témoignage mis à jour')
      router.back()
    }

    await queryClient.invalidateQueries({
      queryKey: ['place', config.placeId, 'reviews'],
    })
  }

  function createForm(config: PresenterConfig): FormType {
    if (config.type === 'create') {
      return {
        ...initialForm,
      }
    } else {
      return {
        score: config.review.score,
        message: config.review.message,
        images: config.review.images.map(image => ({
          id: image.id,
          url: image.largeUrl,
          status: 'uploaded',
        })),
        geocache: config.review.geocache ?? false,
      }
    }
  }

  const queryClient = useQueryClient()
  const snackbar = useSnackbar()
  const { imageSelector, reviewsGateway, router } = useDependencies()

  const form = useFormik({
    initialValues: {
      ...createForm(config),
    },
    onSubmit: submit,
    validationSchema: toFormikValidationSchema(validator),
  })

  return {
    isEdition: config.type === 'update',
    form,
    isSubmittable: form.values.images.every(
      image => image.status === 'uploaded',
    ),
    pickImages: async () => {
      await imageSelector.pickManyAndStoreAsMedia({
        onSelected: medias =>
          form.setValues(values => ({
            ...values,
            images: [
              ...form.values.images,
              ...medias.map(asset => ({
                id: asset.id,
                url: asset.url,
                status: 'pending' as const,
              })),
            ],
          })),
        onUploaded: ({ id, media }) =>
          form.setValues(values => ({
            ...values,
            images: values.images.map(image =>
              image.id === id
                ? {
                    id: media.id,
                    url: media.url,
                    status: 'uploaded' as const,
                  }
                : image,
            ),
          })),
        onFailed: id =>
          form.setValues(values => ({
            ...values,
            images: values.images.filter(image => image.id !== id),
          })),
      })
    },
    deleteImage: (id: string) => {
      form.setValues({
        ...form.values,
        images: form.values.images.filter(image => image.id !== id),
      })
    },
  }
}
