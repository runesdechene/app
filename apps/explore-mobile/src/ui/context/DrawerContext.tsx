import { Colors, Spacing } from '@/ui/constants'
import { createContext, useContext, useRef, useState } from 'react'
import { Modal } from 'react-native'
import styled from 'styled-components/native'
import { Button, IconType } from '../libs'

type Option = {
  key: string
  title: string
  icon: IconType
}

type ShowConfig = { options: Option[] }
type Context = {
  show: (config: ShowConfig) => Promise<string | null>
}

const Context = createContext<Context>({
  show: () => Promise.resolve(null),
})

export const DrawerProvider = ({ children }: { children: any }) => {
  const cancel = () => {
    setState({
      visible: false,
      options: state.options,
    })

    if (promises.current) {
      promises.current.accept(null)
    }
  }

  const open = (config: ShowConfig) => {
    setState({
      visible: true,
      options: config.options,
    })
  }

  const select = (option: Option) => {
    setState({
      visible: false,
      options: state.options,
    })

    if (promises.current) {
      promises.current.accept(option.key)
    }
  }

  const promises = useRef<{
    accept: (key: string | null) => void
    reject: () => void
  } | null>(null)
  const [state, setState] = useState<{
    visible: boolean
    options: Option[]
  }>({
    visible: false,
    options: [],
  })

  return (
    <Context.Provider
      value={{
        show: async config => {
          open(config)
          return new Promise((accept, reject) => {
            promises.current = { accept, reject }
          })
        },
      }}
    >
      {children}
      <Modal visible={state.visible} onRequestClose={cancel} transparent={true}>
        <ModalOverlay onPress={cancel}>
          <ModalView>
            {state.options.map(option => (
              <Button
                key={option.key}
                color="default"
                noBorder={true}
                onPress={() => select(option)}
                iconName={option.icon}
                size="S"
              >
                {option.title}
              </Button>
            ))}
          </ModalView>
        </ModalOverlay>
      </Modal>
    </Context.Provider>
  )
}

export const useDrawer = () => {
  return useContext(Context)
}

const ModalOverlay = styled.Pressable`
  background-color: rgba(0, 0, 0, 0.15);
  height: 100%;
  width: 100%;

  display: flex;
  flex-direction: row;
  align-items: flex-end;
`

const ModalView = styled.View`
  background-color: ${Colors.background};
  width: 100%;
  padding: ${Spacing.padding.screen}px;
  flex-direction: column;
  gap: ${Spacing.gap.L}px;
`
