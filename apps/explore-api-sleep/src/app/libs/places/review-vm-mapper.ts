import { Review } from '../../domain/entities/review.js';
import { ApiReview } from '../../application/viewmodels/api-review.js';

export class ReviewVmMapper {
  toViewModel(review: Review): ApiReview {
    const user = review.user.unwrap();
    const profileImage = user.profileImageId
      ? user.profileImageId.unwrap()
      : null;

    return {
      id: review.id,
      user: {
        id: user.id,
        lastName: user.lastName,
        profileImageUrl: profileImage
          ? profileImage.findUrl(['png_small', 'original'])
          : null,
      },
      images: review.images.getItems().map((image) => ({
        id: image.id,
        thumbnailUrl: image.findUrl(['png_small', 'original'])!,
        largeUrl: image.findUrl(['png_medium', 'original'])!,
      })),
      score: review.score,
      message: review.message,
      geocache: review.geocache ?? false,
      createdAt: review.createdAt.toISOString(),
    };
  }
}
