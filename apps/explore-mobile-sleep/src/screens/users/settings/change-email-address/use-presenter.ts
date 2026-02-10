import { useDependencies } from '@/ui/dependencies/Dependencies'
import { ApiMyInformations } from '@model'
import { useSnackbar } from '@ui'
import { useFormik } from 'formik'
import z from 'zod'
import { toFormikValidationSchema } from 'zod-formik-adapter'

const validator = z.object({
  emailAddress: z.string({ message: 'Adresse email requise' }).email(),
})

type FormType = z.infer<typeof validator>

export const usePresenter = ({ user }: { user: ApiMyInformations }) => {
  async function submit(values: FormType) {
    try {
      await accountGateway.changeEmailAddress({
        emailAddress: values.emailAddress,
      })

      await authenticator.refreshUser()

      snackbar.success('Adresse e-mail modifiée')
    } catch (e) {
      snackbar.error(e)
    }
  }

  const snackbar = useSnackbar()
  const { accountGateway, authenticator } = useDependencies()

  const form = useFormik<FormType>({
    initialValues: {
      emailAddress: user.emailAddress,
    },
    onSubmit: submit,
    validationSchema: toFormikValidationSchema(validator),
  })

  return {
    form,
  }
}
