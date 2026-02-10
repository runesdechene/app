import React from 'react'
import { SvgXml } from 'react-native-svg'

const xml = `
<svg xmlns="http://www.w3.org/2000/svg" width="8" height="13" viewBox="0 0 8 13" fill="none">
<path d="M6.58337 11.375L1.58337 6.375L6.58337 1.375" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`
type Props = {
  color: string
}
export const ChevronLeft = ({ color }: Props) => (
  <SvgXml xml={xml} width="100%" height="100%" stroke={color} />
)
