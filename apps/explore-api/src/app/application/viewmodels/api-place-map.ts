import { Nullable } from '../../libs/shared/types.js';
import { ApiPlaceType } from './api-place-type.js';

export type ApiPlaceMap = {
  id: string;
  title: string;
  type: ApiPlaceType;
  location: {
    latitude: number;
    longitude: number;
  };
  requester: Nullable<{
    viewed: boolean;
  }>;
  url?: string;
};
