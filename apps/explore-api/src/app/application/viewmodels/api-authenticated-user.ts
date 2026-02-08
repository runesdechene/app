import { GetSnapshot } from '../../libs/shared/snapshot.js';
import { Token } from '../../domain/model/token.js';
import { Nullable } from '../../libs/shared/types.js';

export type ApiAuthenticatedUser = {
  user: {
    id: string;
    emailAddress: string;
    role: string;
    rank: string;
    lastName: string;
    profileImage: Nullable<{
      id: string;
      url: string;
    }>;
  };
  refreshToken: GetSnapshot<Token>;
  accessToken: GetSnapshot<Token>;
};
