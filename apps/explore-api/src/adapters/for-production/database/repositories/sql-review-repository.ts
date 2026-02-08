import { BaseSqlRepository } from '../base-sql-repository.js';
import { Review } from '../../../../app/domain/entities/review.js';
import { IReviewRepository } from '../../../../app/application/ports/repositories/review-repository.js';

export class SqlReviewRepository
  extends BaseSqlRepository<Review>
  implements IReviewRepository {}
