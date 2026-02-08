import React from 'react'
import { SvgXml } from 'react-native-svg'

const xml = `
<svg width="15" height="15" viewBox="0 0 15 14" xmlns="http://www.w3.org/2000/svg" fill='none'>
<g clip-path="url(#clip0_1305_502)">
<path d="M7.5 1.25L9.43125 5.1625L13.75 5.79375L10.625 8.8375L11.3625 13.1375L7.5 11.1063L3.6375 13.1375L4.375 8.8375L1.25 5.79375L5.56875 5.1625L7.5 1.25Z" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<defs>
<clipPath id="clip0_1305_502">
<rect width="15" height="15"/>
</clipPath>
</defs>
</svg>
`
type Props = {
  color: string
}
export const StarIcon = ({ color }: Props) => (
  <SvgXml xml={xml} width="100%" height="100%" stroke={color} />
)
