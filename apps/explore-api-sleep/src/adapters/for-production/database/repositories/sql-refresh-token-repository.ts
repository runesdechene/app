import { RefreshToken } from '../../../../app/domain/entities/refresh-token.js';
import { IRefreshTokenRepository } from '../../../../app/application/ports/repositories/refresh-token-repository.js';
import { Optional } from '../../../../app/libs/shared/optional.js';
import { BaseSqlRepository } from '../base-sql-repository.js';

export class SqlRefreshTokenRepository
  extends BaseSqlRepository<RefreshToken>
  implements IRefreshTokenRepository
{
  async byValue(value: string) {
    const record = await this.repository.findOne({ value });
    return Optional.of(record ? record : null);
  }
}
