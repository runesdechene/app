import { Nullable } from '../../libs/shared/types.js';
import { ApiPlaceImagesType, ApiPlaceType } from './api-place-type.js';

export type ApiPlaceSummary = {
  id: string;
  title: string;
  imageUrl: Nullable<string>;
  type: ApiPlaceType;
  location: {
    latitude: number;
    longitude: number;
  };
  requester: Nullable<{
    bookmarked: boolean;
    liked: boolean;
    explored: boolean;
  }>;
  avg_score?: number;
  url?: string;
};
