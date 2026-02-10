import styled from 'styled-components/native'

export const Logo = () => {
  return <LogoContainer source={require('@/ui/assets/images/logo-home.png')} />
}

const LogoContainer = styled.Image.attrs({ resizeMode: 'contain' })`
  height: 150px;
  width: 100%;
`
