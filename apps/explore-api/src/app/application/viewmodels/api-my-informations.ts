import { Nullable } from '../../libs/shared/types.js';

export type ApiMyInformations = {
  id: string;
  emailAddress: string;
  role: string;
  rank: string;
  gender: Nullable<string>;
  lastName: string;
  biography: string;
  instagramId: Nullable<string>;
  websiteUrl: Nullable<string>;
  profileImage: Nullable<{
    id: string;
    url: string;
  }>;
};
