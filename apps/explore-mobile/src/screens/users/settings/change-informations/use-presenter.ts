import { useDependencies } from '@/ui/dependencies/Dependencies'
import { ApiMyInformations } from '@model'
import { useSnackbar } from '@ui'
import { useFormik } from 'formik'
import z from 'zod'
import { toFormikValidationSchema } from 'zod-formik-adapter'

const validator = z.object({
  lastName: z
    .string({ message: "Nom d'aventurier requis" })
    .min(2, 'Au moins 2 caractères')
    .max(100, 'Moins de 100 caractères'),
  instagramId: z.string().max(100, 'Maximum 100 caractères').optional(),
  websiteUrl: z.string().max(100, 'Maximum 100 caractères').optional(),
  biography: z.string().max(500, 'Maximum 500 caractères').optional(),
  profileImage: z
    .object({
      id: z.string(),
      url: z.string(),
      status: z.enum(['pending', 'uploaded']),
    })
    .nullable(),
})

type FormType = z.infer<typeof validator>

export const usePresenter = ({ user }: { user: ApiMyInformations }) => {
  const { router } = useDependencies()
  async function submit(values: FormType) {
    try {
      await accountGateway.changeInformations({
        lastName: values.lastName,
        biography: values.biography,
        profileImageId: values.profileImage?.id ?? null,
        instagramId: values.instagramId,
        websiteUrl: values.websiteUrl,
      })

      await authenticator.refreshUser()

      snackbar.success('Informations modifiées')
      router.resetTo('/profile')
    } catch (e) {
      snackbar.error(e)
    }
  }

  const snackbar = useSnackbar()
  const { imageSelector, accountGateway, authenticator } = useDependencies()

  const form = useFormik<FormType>({
    initialValues: {
      lastName: user.lastName,
      biography: user.biography,
      instagramId: user.instagramId,
      websiteUrl: user.websiteUrl,
      profileImage: user.profileImage
        ? {
            id: user.profileImage.id,
            url: user.profileImage.url,
            status: 'uploaded' as const,
          }
        : null,
    },
    onSubmit: submit,
    validationSchema: toFormikValidationSchema(validator),
  })

  return {
    form,
    isSubmittable: form.values.profileImage?.status !== 'pending',
    pickImage: async () => {
      await imageSelector.pickOneAndStoreAsMedia({
        onSelected: media => {
          return form.setValues(values => ({
            ...values,
            profileImage: {
              id: media.id,
              url: media.url,
              status: 'pending' as const,
            },
          }))
        },
        onUploaded: ({ media }) => {
          return form.setValues(values => ({
            ...values,
            profileImage: {
              id: media.id,
              url: media.url,
              status: 'uploaded' as const,
            },
          }))
        },
        onFailed: () => {
          return form.setValues(values => ({
            ...values,
            profileImage: null,
          }))
        },
      })
    },
    deleteImage: () => {
      form.setValues({
        ...form.values,
        profileImage: null,
      })
    },
  }
}
