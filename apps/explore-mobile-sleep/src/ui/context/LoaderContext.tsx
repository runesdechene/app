import { createContext, useContext, useState } from 'react'
import { Loader } from '../libs'

type Context = {
  show: () => void
  hide: () => void
}

const Context = createContext<Context>({
  show: () => {},
  hide: () => {},
})

export const LoaderProvider = ({ children }: { children: any }) => {
  const [visible, setVisible] = useState<boolean>(false)

  return (
    <Context.Provider
      value={{
        show: async () => {
          setVisible(true)
        },
        hide: async () => {
          setVisible(false)
        },
      }}
    >
      {children}
      {visible && <Loader />}
    </Context.Provider>
  )
}

export const useLoader = () => {
  return useContext(Context)
}
