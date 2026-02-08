import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useSnackbar } from '@ui'
import { useFormik } from 'formik'
import z from 'zod'
import { toFormikValidationSchema } from 'zod-formik-adapter'

const validator = z
  .object({
    password: z
      .string({ message: 'Nouveau mot de passe requis' })
      .min(2, 'Au moins 2 caractères')
      .max(100, 'Moins de 100 caractères'),
    passwordBis: z.string({ message: 'Confirmation du mot de passe requise' }),
  })
  .superRefine(({ password, passwordBis }, ctx) => {
    if (passwordBis !== password) {
      ctx.addIssue({
        code: 'custom',
        message: 'Les mots de passe doivent correspondre',
        path: ['passwordBis'],
      })
    }
  })

type FormType = z.infer<typeof validator>

export const usePresenter = () => {
  async function submit(values: FormType) {
    try {
      await accountGateway.changePassword({
        newPassword: values.password,
      })

      snackbar.success('Mot de passe modifié')
    } catch (e) {
      snackbar.error(e)
    }
  }

  const snackbar = useSnackbar()
  const { accountGateway } = useDependencies()

  const form = useFormik<FormType>({
    initialValues: {
      password: '',
      passwordBis: '',
    },
    onSubmit: submit,
    validationSchema: toFormikValidationSchema(validator),
  })

  return {
    form,
  }
}
