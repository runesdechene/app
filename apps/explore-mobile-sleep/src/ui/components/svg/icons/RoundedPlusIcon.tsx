import React from 'react'
import { SvgXml } from 'react-native-svg'

const xml = `
<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1337_505)">
<path d="M11.0002 20.1666C16.0628 20.1666 20.1668 16.0625 20.1668 10.9999C20.1668 5.93731 16.0628 1.83325 11.0002 1.83325C5.93755 1.83325 1.8335 5.93731 1.8335 10.9999C1.8335 16.0625 5.93755 20.1666 11.0002 20.1666Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7.3335 11H14.6668" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M11 7.33325V14.6666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<defs>
<clipPath id="clip0_1337_505">
<rect width="22" height="22"/>
</clipPath>
</defs>
</svg>
`
type Props = {
  color: string
}
export const RoundedPlusIcon = ({ color }: Props) => (
  <SvgXml xml={xml} width="100%" height="100%" stroke={color} />
)
