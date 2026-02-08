import { Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user.js';
import { ApiAdminUser } from '../viewmodels/api-admin-user.js';

@Injectable()
export class MikroApiAdminUserConverter {
  public async convert(user: User): Promise<ApiAdminUser> {
    return {
      id: user.id,
      emailAddress: user.emailAddress,
      role: user.role,
      rank: user.rank,
      lastName: user.lastName,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
