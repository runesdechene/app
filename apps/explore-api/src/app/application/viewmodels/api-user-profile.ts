import { Nullable } from '../../libs/shared/types.js';

export type ApiUserProfile = {
  id: string;
  lastName: string;
  biography: string;
  profileImageUrl: Nullable<string>;
  instagramId: Nullable<string>;
  websiteUrl: Nullable<string>;
  metrics: {
    placesAdded: number;
    placesExplored: number;
  };
};
