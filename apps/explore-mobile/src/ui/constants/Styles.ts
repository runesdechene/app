/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

export const Colors = {
  text: '#454242',
  label: '#6A6563',
  darkBackground: '#21282E',
  background: '#F8F8F7',
  superBackground: '#FFFFFF',
  link: '#6B65BE',
  error: '#C74446',
  yellow: '#FFC107',
  separator: '#D9D9D9',
  tag: {
    background: '#E1D7F3',
    text: '#5E477B',
  },
  button: {
    default: {
      background: {
        default: '#F3F2F2',
        active: '#56534F',
      },
      text: {
        default: '#6A6563',
        active: '#D8D2CF',
      },
      border: {
        default: '1px solid #7E7875',
        active: 'none',
      },
    },
    disable: {
      background: {
        default: '#F3F2F2',
        active: '#F3F2F2',
      },
      text: {
        default: '#C5C5C5',
        active: '#C5C5C5',
      },
      border: {
        default: 'none',
        active: 'none',
      },
    },
    red: {
      background: {
        default: '#FDEFEF',
        active: '#E6B6B6',
      },
      text: {
        default: '#84352F',
        active: '#84352F',
      },
      border: {
        default: '1px solid #B16661',
        active: '1px solid #B16661',
      },
    },
    green: {
      background: {
        default: '#E9F6E7',
        active: '#BBE8C2',
      },
      text: {
        default: '#527E4F',
        active: '#527E4F',
      },
      border: {
        default: '1px solid #7DA17B',
        active: '1px solid #7DA17B',
      },
    },
    blue: {
      background: {
        default: '#ECF3FC',
        active: '#C0CFEE',
      },
      text: {
        default: '#3F5A93',
        active: '#3F5A93',
      },
      border: {
        default: '1px solid #7896D7',
        active: '1px solid #7896D7',
      },
    },
    yellow: {
      background: {
        default: '#FCF9EF',
        active: '#E6D5B6',
      },
      text: {
        default: '#856230',
        active: '#856230',
      },
      border: {
        default: '1px solid #C9A87A',
        active: '1px solid #C9A87A',
      },
    },
    purple: {
      background: {
        default: '#FDEFEF',
        active: '#E6B6B6',
      },
      text: {
        default: '#5E477B',
        active: '#5E477B',
      },
      border: {
        default: '1px solid #AC93CA',
        active: '1px solid #AC93CA',
      },
    },
    primary: {
      background: {
        default: '#B24A55',
        active: '#B24A55',
      },
      text: {
        default: '#FCF9EF',
        active: '#FCF9EF',
      },
      border: {
        default: 'none',
        active: 'none',
      },
    },
    special: {
      img_background: require('@/ui/assets/images/btn_special_texture.png'),
      background: {
        default: '#FFFDFA',
        active: '#FFFDFA',
      },
      text: {
        default: '#FFFDFA',
        active: '#FFFDFA',
      },
      border: {
        default: 'none',
        active: 'none',
      },
    },
    invisible: {
      background: {
        default: 'transparent',
        active: 'transparent',
      },
      text: {
        default: '#6A6563',
        active: '#6A6563',
      },
      border: {
        default: 'transparent',
        active: 'transparent',
      },
    },
  },
  buttonPicto: {
    curiosity: {
      color: 'yellow',
    },
    historic: {
      color: 'red',
    },
    castle: {
      color: 'red',
    },
    cathedral: {
      color: 'red',
    },
    ruin: {
      color: 'red',
    },
    dolmen: {
      color: 'red',
    },
    statue: {
      color: 'red',
    },
    temple: {
      color: 'red',
    },
    sanctuary: {
      color: 'red',
    },
    monument: {
      color: 'red',
    },
    natural: {
      color: 'green',
    },
    cave: {
      color: 'green',
    },
    tree: {
      color: 'green',
    },
    mountain: {
      color: 'green',
    },
    lake: {
      color: 'green',
    },
    panoramic: {
      color: 'green',
    },
    shop: {
      color: 'purple',
    },
    rest: {
      color: 'blue',
    },
    van: {
      color: 'blue',
    },
    gite: {
      color: 'blue',
    },
    shelter: {
      color: 'blue',
    },
  },
  input: {
    default: {
      background: '#FFFDFA',
      text: '#454242',
      placeholder: '#6A6563',
      border: '1px solid #C7BBB4',
      borderColor: '#C7BBB4',
    },
    disable: {
      background: '#F3F2F2',
      text: '#C5C5C5',
      placeholder: '#C5C5C5',
      border: '1px solid #C5C5C5',
      borderColor: '#C5C5C5',
    },
  },
}

export type ButtonPictoType = keyof typeof Colors.buttonPicto
export type ButtonColors = keyof typeof Colors.button
export type InputColors = keyof typeof Colors.input

export const Fonts = {
  Title: 'BebasNeue_Regular',
  Button: 'BebasNeue_Regular',
  Text: {
    Regular: 'Inconsolata_Regular',
    SemiBold: 'Inconsolata_SemiBold',
    Bold: 'Inconsolata_Bold',
  },
}

export const Sizes = {
  text: {
    S: {
      size: 14,
      lineHeight: 20,
    },
    M: {
      size: 16,
      lineHeight: 22,
    },
  },
  title: {
    h1: {
      size: 40,
      lineHeight: 44,
    },
    h2: {
      size: 24,
      lineHeight: 32,
    },
    h3: {
      size: 18,
      lineHeight: 26,
    },
    h4: {
      size: 14,
      lineHeight: 24,
    },
  },
  icon: {
    XS: 14,
    S: 18,
    M: 20,
    L: 24,
    XL: 40,
  },
  avatar: {
    S: 32,
    M: 46,
    L: 54,
    XL: 108,
  },
}
export type TextSizes = keyof typeof Sizes.text
export type TitleSizes = keyof typeof Sizes.title
export type IconSizes = keyof typeof Sizes.icon
export type AvatarSizes = keyof typeof Sizes.avatar

export const Radius = {
  small: 10,
  default: 20,
  round: 60,
}
export type RadiusSizes = keyof typeof Radius

export const Opacity = {
  normal: 1,
  blurry: 0.85,
  disable: 0.5,
}
export type OpacityMode = keyof typeof Opacity

export const Spacing = {
  gap: {
    NONE: '0',
    XS: '4',
    S: '8',
    M: '10',
    L: '16',
    XL: '16',
    AUTO: 'auto',
  },
  padding: {
    S: 10,
    M: 16,
    L: 24,
    XL: 32,
    screen: 26,
  },
}
export type Gap = keyof typeof Spacing.gap
export type Padding = keyof typeof Spacing.padding
