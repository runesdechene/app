export type ApiPlaceType = {
  id: string;
  imageUrl: string;
  color: string;
  background: string;
  border: string;
  fadedColor: string;
  title: string;
  order: number;
  root: boolean;
  images: ApiPlaceImagesType;
  parent: string;
};

export type ApiPlaceImagesType = {
  map?: string;
  regular?: string;
  background?: string;
  local?: string;
  localMini?: string;
};
