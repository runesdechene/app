import React from 'react'
import { SvgXml } from 'react-native-svg'

const xml = `
<svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21" fill="none">
<path d="M10.75 11.4584C11.2102 11.4584 11.5833 11.0853 11.5833 10.6251C11.5833 10.1648 11.2102 9.79175 10.75 9.79175C10.2897 9.79175 9.91663 10.1648 9.91663 10.6251C9.91663 11.0853 10.2897 11.4584 10.75 11.4584Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M10.75 5.62492C11.2102 5.62492 11.5833 5.25182 11.5833 4.79159C11.5833 4.33135 11.2102 3.95825 10.75 3.95825C10.2897 3.95825 9.91663 4.33135 9.91663 4.79159C9.91663 5.25182 10.2897 5.62492 10.75 5.62492Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M10.75 17.2917C11.2102 17.2917 11.5833 16.9186 11.5833 16.4583C11.5833 15.9981 11.2102 15.625 10.75 15.625C10.2897 15.625 9.91663 15.9981 9.91663 16.4583C9.91663 16.9186 10.2897 17.2917 10.75 17.2917Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`
type Props = {
  color: string
}
export const ThreeDotIcon = ({ color }: Props) => (
  <SvgXml xml={xml} width="100%" height="100%" stroke={color} />
)
