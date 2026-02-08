import { HttpException } from '@/shared/http/http-exception'
import { createContext, useContext, useState } from 'react'
import { Snackbar } from 'react-native-paper'

const Context = createContext({
  error: (error: any) => {},
  success: (message: string) => {},
})

export const SnackbarProvider = ({ children }: { children: any }) => {
  function showError(error: any) {
    if (error instanceof HttpException) {
      setMessage(error.message)
    } else if (error instanceof Error) {
      setMessage(error.message)
    } else {
      setMessage('Unknown error')
    }

    setVisible(true)
  }

  function showSuccess(message: string) {
    setMessage(message)
    setVisible(true)
  }

  const [message, setMessage] = useState<string | null>(null)
  const [visible, setVisible] = useState<boolean>(false)

  return (
    <Context.Provider
      value={{
        error: showError,
        success: showSuccess,
      }}
    >
      {children}
      <Snackbar
        duration={2000}
        visible={visible}
        onDismiss={() => setVisible(false)}
      >
        {message}
      </Snackbar>
    </Context.Provider>
  )
}

export const useSnackbar = () => {
  return useContext(Context)
}
