import { Fonts } from '@/ui/constants'
import { createContext, useContext, useRef, useState } from 'react'
import { Modal } from 'react-native'
import styled from 'styled-components/native'

type Option = {
  key: string
  title: string
  type?: 'danger'
}

type ShowConfig = { title: string; message: string; options: Option[] }
type Context = {
  show: (config: ShowConfig) => Promise<string | null>
}

const Context = createContext<Context>({
  show: () => Promise.resolve(null),
})

const defaultConfig: ShowConfig = { title: '', message: '', options: [] }

export const ModalProvider = ({ children }: { children: any }) => {
  const cancel = () => {
    setState({
      visible: false,
      config: state.config,
    })

    if (promises.current) {
      promises.current.accept(null)
    }
  }

  const open = (config: ShowConfig) => {
    setState({
      visible: true,
      config,
    })
  }

  const select = (option: Option) => {
    setState({
      visible: false,
      config: state.config,
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
    config: ShowConfig
  }>({
    visible: false,
    config: defaultConfig,
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
            <ModalTitle>{state.config.title.toUpperCase()}</ModalTitle>
            <ModalMessage>{state.config.message}</ModalMessage>
            <ModalOptions>
              {state.config.options.map(option => (
                <ModalOption key={option.key} onPress={() => select(option)}>
                  <ModalOptionText>{option.title}</ModalOptionText>
                </ModalOption>
              ))}
            </ModalOptions>
          </ModalView>
        </ModalOverlay>
      </Modal>
    </Context.Provider>
  )
}

export const useModal = () => {
  return useContext(Context)
}

const ModalOverlay = styled.Pressable`
  background-color: rgba(0, 0, 0, 0.45);
  height: 100%;
  width: 100%;

  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`

const ModalView = styled.View`
  background-color: #fff;
  border-radius: 8px;

  padding: 24px 24px;
  width: 300px;
`

const ModalTitle = styled.Text`
  font-family: ${Fonts.Text.Bold};
  font-size: 16;
`

const ModalMessage = styled.Text`
  margin-top: 12px;

  font-family: ${Fonts.Text.Regular};
  font-size: 16;
`

const ModalOptions = styled.View`
  margin-top: 20px;

  display: flex;
  flex-direction: row;

  justify-content: flex-end;
  gap: 16px;
`

const ModalOption = styled.Pressable`
  display: flex;
  flex-direction: row;
  align-items: center;
`

const ModalOptionText = styled.Text`
  font-family: ${Fonts.Title};
  font-size: 16;
  color: #333;
`
