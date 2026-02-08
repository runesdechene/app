import { QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { BaseCommand, BaseCommandHandler } from '../../libs/shared/command.js';
import { NotFoundException } from '../../libs/exceptions/not-found-exception.js';
import { ApiMyInformations } from '../viewmodels/api-my-informations.js';
import { EntityManager } from '@mikro-orm/postgresql';
import { User } from '../../domain/entities/user.js';
import { DateUtils } from '../../libs/shared/date-utils.js';

export class GetMyInformationsQuery extends BaseCommand<void> {}

@QueryHandler(GetMyInformationsQuery)
export class GetMyInformationsHandler extends BaseCommandHandler<
  GetMyInformationsQuery,
  ApiMyInformations
> {
  constructor(
    @Inject(EntityManager) private readonly entityManager: EntityManager,
  ) {
    super();
  }

  async execute(query: GetMyInformationsQuery) {
    const id = query.getUserId();
    const user = await this.entityManager
      .createQueryBuilder(User)
      .leftJoinAndSelect('profileImageId', 'pi')
      .where({ id })
      .getSingleResult();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      emailAddress: user.emailAddress,
      role: user.role,
      rank: user.rank,
      gender: user.gender,
      lastName: user.lastName,
      biography: user.biography,
      profileImage: this.getProfileImage(user),
      instagramId: user.instagramId ?? null,
      websiteUrl: user.websiteUrl ?? null,
    };
  }

  private getProfileImage(user: User) {
    if (!user.profileImageId) {
      return null;
    }

    const profileImage = user.profileImageId.unwrap();

    return {
      id: profileImage.id,
      url:
        profileImage.findVariantMatching([
          'png_small',
          'webp_small',
          'original',
        ])?.url ?? '',
    };
  }
}
