import { Optional } from '../../../libs/shared/optional.js';
import { Review } from '../../../domain/entities/review.js';

export const I_REVIEW_REPOSITORY = Symbol('I_REVIEW_REPOSITORY');

export interface IReviewRepository {
  byId(id: string): Promise<Optional<Review>>;

  save(review: Review): Promise<void>;

  delete(review: Review): Promise<void>;

  clear(): Promise<void>;
}
