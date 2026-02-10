import { ImageMedia } from '../../../app/domain/entities/image-media.js';
import { Place } from '../../../app/domain/entities/place.js';
import { PlaceType } from '../../../app/domain/entities/place-type.js';
import { PlaceLiked } from '../../../app/domain/entities/place-liked.js';
import { PlaceBookmarked } from '../../../app/domain/entities/place-bookmarked.js';
import { PlaceViewed } from '../../../app/domain/entities/place-viewed.js';
import { PlaceExplored } from '../../../app/domain/entities/place-explored.js';
import { User } from '../../../app/domain/entities/user.js';
import { RefreshToken } from '../../../app/domain/entities/refresh-token.js';
import { PasswordReset } from '../../../app/domain/entities/password-reset.js';
import { MemberCode } from '../../../app/domain/entities/member-code.js';
import { Review } from '../../../app/domain/entities/review.js';

export const allEntities = [
  ImageMedia,
  Place,
  PlaceType,
  PlaceLiked,
  PlaceBookmarked,
  PlaceViewed,
  PlaceExplored,
  User,
  RefreshToken,
  PasswordReset,
  MemberCode,
  Review,
];
