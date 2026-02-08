import { useDependencies } from '@/ui/dependencies/Dependencies'
import { useSnackbar } from '@ui'
import { useFormik } from 'formik'
import z from 'zod'
import { toFormikValidationSchema } from 'zod-formik-adapter'

const validator = z
  .object({
    lastName: z
      .string({ message: "Nom d'aventurier(e) requis" })
      .min(2, 'Au moins 2 caractères'),
    emailAddress: z
      .string({ message: 'Adresse e-mail requise' })
      .email('Email incorrect'),
    password: z
      .string({ message: 'Mot de passe requis' })
      .min(8, 'Au moins 8 caractères'),
    passwordConfirmation: z.string({ message: 'Confirmation requise' }).min(8),
  })
  .refine(data => data.password === data.passwordConfirmation, {
    message: 'Les mots de passe ne correspondent pas',
  })

type FormType = z.infer<typeof validator>
const initialForm: FormType = {
  lastName: '',
  emailAddress: '',
  password: '',
  passwordConfirmation: '',
}

export const usePresenter = () => {
  async function submit(values: FormType) {
    try {
      const user = await sessionGateway.register({
        lastName: values.lastName,
        emailAddress: values.emailAddress,
        password: values.password,
        gender: 'unknown',
        code: null,
      })

      await authenticator.onRegistered(user)
      router.replace('/(app)/home')

      snackbar.success('Inscription réussie !')
    } catch (e) {
      snackbar.error(e)
    }
  }

  const snackbar = useSnackbar()
  const { router, authenticator, sessionGateway } = useDependencies()

  const form = useFormik({
    initialValues: initialForm,
    onSubmit: submit,
    validationSchema: toFormikValidationSchema(validator),
  })

  return {
    form,
  }
}
