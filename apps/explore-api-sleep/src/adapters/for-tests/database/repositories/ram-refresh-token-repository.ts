import { IRefreshTokenRepository } from '../../../../app/application/ports/repositories/refresh-token-repository.js';
import { Optional } from '../../../../app/libs/shared/optional.js';
import { BaseRamRepository } from '../base-ram-repository.js';
import { RefreshToken } from '../../../../app/domain/entities/refresh-token.js';

export class RamRefreshTokenRepository
  extends BaseRamRepository<RefreshToken>
  implements IRefreshTokenRepository
{
  async byValue(value: string): Promise<Optional<RefreshToken>> {
    return this.findOne((record) => record.value === value);
  }
}
