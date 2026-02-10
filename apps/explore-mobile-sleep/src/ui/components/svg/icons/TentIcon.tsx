import React from 'react'
import { SvgXml } from 'react-native-svg'

const xml = `
<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1337_512)">
<path d="M3.33317 5.00008C4.25365 5.00008 4.99984 4.25389 4.99984 3.33341C4.99984 2.41294 4.25365 1.66675 3.33317 1.66675C2.4127 1.66675 1.6665 2.41294 1.6665 3.33341C1.6665 4.25389 2.4127 5.00008 3.33317 5.00008Z"  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M11.6665 4.16675L14.1665 1.66675L16.6665 4.16675"  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M11.6665 8.33325L14.1665 5.83325L16.6665 8.33325"  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M14.1665 11.6667V1.66675"  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M14.1665 11.6667H5.83317L1.6665 18.3334H18.3332L14.1665 11.6667Z"  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M6.6665 11.6667V18.3334"  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7.5 11.6667L11.6667 18.3334"  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<defs>
<clipPath id="clip0_1337_512">
<rect width="20" height="20" fill="white"/>
</clipPath>
</defs>
</svg>

`
type Props = {
  color: string
}
export const TentIcon = ({ color }: Props) => (
  <SvgXml xml={xml} width="100%" height="100%" stroke={color} />
)
