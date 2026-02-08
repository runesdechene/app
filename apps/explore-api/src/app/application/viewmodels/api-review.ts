import { Nullable } from '../../libs/shared/types.js';

export type ApiReview = {
  id: string;
  images: Array<{
    id: string;
    thumbnailUrl: string;
    largeUrl: string;
  }>;
  user: {
    id: string;
    lastName: string;
    profileImageUrl: Nullable<string>;
  };
  createdAt: string;
  score: number;
  geocache: boolean;
  message: string;
};
