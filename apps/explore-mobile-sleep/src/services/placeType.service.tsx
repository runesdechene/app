import {
  CuriosityBackground,
  HistoricBackground,
  NaturalBackground,
  RestBackground,
  ShopBackground,
} from '@/ui/components/svg/placeType'
import { ApiPlaceType } from '@model'

type IconCategory = {
  main: any
  map: any
  background?: any
  map_mini?: any
  parent?: string
}
const icons: { [key: string]: IconCategory } = {
  flag: {
    main: require('@/ui/assets/images/site_flag.png'),
    map: require('@/ui/assets/images/site_flag.png'),
    map_mini: require('@/ui/assets/images/site_flag.png'),
    background: require('@/ui/assets/images/site_flag.png'),
  },
  stand: {
    main: require('@/ui/assets/images/stand_nomade.png'),
    map: require('@/ui/assets/images/stand_nomade.png'),
    map_mini: require('@/ui/assets/images/stand_nomade.png'),
    background: require('@/ui/assets/images/stand_nomade.png'),
  },
  /**
   * Curiosity section
   */
  curiosity: {
    main: require('@/ui/assets/images/placeType/curiosity/main.webp'),
    map: require('@/ui/assets/images/placeType/curiosity/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/curiosity/map_mini.webp'),
    background: require('@/ui/assets/images/placeType/curiosity/background.webp'),
  },
  /**
   * Historical section
   */
  historic: {
    main: require('@/ui/assets/images/placeType/historic/main.webp'),
    map: require('@/ui/assets/images/placeType/historic/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/historic/map_mini.webp'),
    background: require('@/ui/assets/images/placeType/historic/background.webp'),
  },
  castle: {
    parent: 'historic',
    main: require('@/ui/assets/images/placeType/historic/castle/main.webp'),
    map: require('@/ui/assets/images/placeType/historic/castle/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/historic/castle/map_mini.webp'),
  },
  cathedral: {
    parent: 'historic',
    main: require('@/ui/assets/images/placeType/historic/cathedral/main.webp'),
    map: require('@/ui/assets/images/placeType/historic/cathedral/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/historic/cathedral/map_mini.webp'),
  },
  ruin: {
    parent: 'historic',
    main: require('@/ui/assets/images/placeType/historic/ruin/main.webp'),
    map: require('@/ui/assets/images/placeType/historic/ruin/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/historic/ruin/map_mini.webp'),
  },
  dolmen: {
    parent: 'historic',
    main: require('@/ui/assets/images/placeType/historic/dolmen/main.webp'),
    map: require('@/ui/assets/images/placeType/historic/dolmen/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/historic/dolmen/map_mini.webp'),
  },
  statue: {
    parent: 'historic',
    main: require('@/ui/assets/images/placeType/historic/statue/main.webp'),
    map: require('@/ui/assets/images/placeType/historic/statue/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/historic/statue/map_mini.webp'),
  },
  temple: {
    parent: 'historic',
    main: require('@/ui/assets/images/placeType/historic/temple/main.webp'),
    map: require('@/ui/assets/images/placeType/historic/temple/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/historic/temple/map_mini.webp'),
  },
  sanctuary: {
    parent: 'historic',
    main: require('@/ui/assets/images/placeType/historic/sanctuary/main.webp'),
    map: require('@/ui/assets/images/placeType/historic/sanctuary/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/historic/sanctuary/map_mini.webp'),
  },
  monument: {
    parent: 'historic',
    main: require('@/ui/assets/images/placeType/historic/monument/main.webp'),
    map: require('@/ui/assets/images/placeType/historic/monument/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/historic/monument/map_mini.webp'),
  },
  /**
   * Natural section
   */
  natural: {
    main: require('@/ui/assets/images/placeType/natural/main.webp'),
    map: require('@/ui/assets/images/placeType/natural/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/natural/map_mini.webp'),
    background: require('@/ui/assets/images/placeType/natural/background.webp'),
  },
  cave: {
    parent: 'natural',
    main: require('@/ui/assets/images/placeType/natural/cave/main.webp'),
    map: require('@/ui/assets/images/placeType/natural/cave/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/natural/cave/map_mini.webp'),
  },
  tree: {
    parent: 'natural',
    main: require('@/ui/assets/images/placeType/natural/tree/main.webp'),
    map: require('@/ui/assets/images/placeType/natural/tree/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/natural/tree/map_mini.webp'),
  },
  mountain: {
    parent: 'natural',
    main: require('@/ui/assets/images/placeType/natural/mountain/main.webp'),
    map: require('@/ui/assets/images/placeType/natural/mountain/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/natural/mountain/map_mini.webp'),
  },
  lake: {
    parent: 'natural',
    main: require('@/ui/assets/images/placeType/natural/lake/main.webp'),
    map: require('@/ui/assets/images/placeType/natural/lake/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/natural/lake/map_mini.webp'),
  },
  panoramic: {
    parent: 'natural',
    main: require('@/ui/assets/images/placeType/natural/panoramic/main.webp'),
    map: require('@/ui/assets/images/placeType/natural/panoramic/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/natural/panoramic/map_mini.webp'),
  },
  /**
   * Shop section
   */
  shop: {
    main: require('@/ui/assets/images/placeType/shop/main.webp'),
    map: require('@/ui/assets/images/placeType/shop/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/shop/map_mini.webp'),
    background: require('@/ui/assets/images/placeType/shop/background.webp'),
  },
  /**
   * Rest section
   */
  rest: {
    main: require('@/ui/assets/images/placeType/rest/main.webp'),
    map: require('@/ui/assets/images/placeType/rest/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/rest/map_mini.webp'),
    background: require('@/ui/assets/images/placeType/rest/background.webp'),
  },
  van: {
    parent: 'rest',
    main: require('@/ui/assets/images/placeType/rest/van/main.webp'),
    map: require('@/ui/assets/images/placeType/rest/van/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/rest/van/map_mini.webp'),
  },
  gite: {
    parent: 'rest',
    main: require('@/ui/assets/images/placeType/rest/gite/main.webp'),
    map: require('@/ui/assets/images/placeType/rest/gite/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/rest/gite/map_mini.webp'),
  },
  shelter: {
    parent: 'rest',
    main: require('@/ui/assets/images/placeType/rest/shelter/main.webp'),
    map: require('@/ui/assets/images/placeType/rest/shelter/map.webp'),
    map_mini: require('@/ui/assets/images/placeType/rest/shelter/map_mini.webp'),
  },
}

export type PlaceIconType = keyof typeof icons
export type PlaceIconSize = keyof IconCategory
class PlaceTypeService {
  getImage(placeTypeName: PlaceIconType, size: PlaceIconSize) {
    if (placeTypeName) {
      const objPlaceType = icons[placeTypeName]
      if (objPlaceType) {
        const img = objPlaceType[size]
        if (img) {
          return img
        } else {
          if (objPlaceType.parent) {
            return icons[objPlaceType.parent][size] ?? ''
          }
          return ''
        }
      } else {
        return ''
      }
    }
  }

  getSvgBackgroung(placeType: ApiPlaceType, forceColor?: string) {
    let TypedSvg = undefined
    switch (placeType.images.local) {
      case 'curiosity':
        TypedSvg = CuriosityBackground
        break
      case 'natural':
        TypedSvg = NaturalBackground
        break
      case 'historic':
        TypedSvg = HistoricBackground
        break
      case 'rest':
        TypedSvg = RestBackground
        break
      case 'shop':
        TypedSvg = ShopBackground
        break
      default:
        break
    }
    return TypedSvg ? (
      <TypedSvg size="S" fill={forceColor ?? placeType.fadedColor} />
    ) : undefined
  }
}

export const placeTypeService = new PlaceTypeService()
