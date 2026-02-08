import React from 'react'
import { SvgXml } from 'react-native-svg'

const xml = `
<svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_1735_1470)">
<path d="M14.4166 1.79175H6.08329C3.78211 1.79175 1.91663 3.65723 1.91663 5.95842V14.2917C1.91663 16.5929 3.78211 18.4584 6.08329 18.4584H14.4166C16.7178 18.4584 18.5833 16.5929 18.5833 14.2917V5.95842C18.5833 3.65723 16.7178 1.79175 14.4166 1.79175Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M13.5834 9.60001C13.6862 10.2935 13.5678 11.0019 13.2448 11.6242C12.9219 12.2465 12.411 12.7512 11.7847 13.0664C11.1585 13.3816 10.4487 13.4913 9.75653 13.38C9.06431 13.2686 8.42484 12.9417 7.92907 12.446C7.4333 11.9502 7.10648 11.3107 6.9951 10.6185C6.88371 9.9263 6.99343 9.21659 7.30865 8.59032C7.62386 7.96405 8.12853 7.45312 8.75086 7.13021C9.37319 6.80729 10.0815 6.68883 10.775 6.79167C11.4825 6.89658 12.1374 7.22623 12.6431 7.73193C13.1488 8.23763 13.4785 8.89257 13.5834 9.60001Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M14.8334 5.54175H14.8425" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<defs>
<clipPath id="clip0_1735_1470">
<rect width="20" height="20" fill="white" transform="translate(0.25 0.125)"/>
</clipPath>
</defs>
</svg>
`
type Props = {
  color: string
}
export const InstagramIcon = ({ color }: Props) => (
  <SvgXml xml={xml} width="100%" height="100%" stroke={color} />
)
