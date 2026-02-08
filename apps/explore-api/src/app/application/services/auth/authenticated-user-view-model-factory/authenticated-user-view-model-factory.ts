import { IAuthenticatedUserViewModelFactory } from './authenticated-user-view-model-factory.interface.js';
import { AccessToken } from '../../../../domain/model/access-token.js';
import { Inject, Injectable } from '@nestjs/common';
import {
  I_IMAGE_MEDIA_REPOSITORY,
  IImageMediaRepository,
} from '../../../ports/repositories/image-media-repository.js';
import { ApiAuthenticatedUser } from '../../../viewmodels/api-authenticated-user.js';
import { User } from '../../../../domain/entities/user.js';
import { RefreshToken } from '../../../../domain/entities/refresh-token.js';

@Injectable()
export class AuthenticatedUserViewModelFactory
  implements IAuthenticatedUserViewModelFactory
{
  constructor(
    @Inject(I_IMAGE_MEDIA_REPOSITORY)
    private readonly imageMediaRepository: IImageMediaRepository,
  ) {}

  async create(
    user: User,
    refreshToken: RefreshToken,
    accessToken: AccessToken,
  ): Promise<ApiAuthenticatedUser> {
    return {
      user: {
        id: user.id,
        emailAddress: user.emailAddress,
        role: user.role,
        rank: user.rank,
        lastName: user.lastName,
        profileImage: await this.getProfileImageUrl(user),
      },
      refreshToken: refreshToken.asToken().snapshot(),
      accessToken: accessToken.snapshot(),
    };
  }

  async getProfileImageUrl(user: User) {
    if (user.profileImageId === null) {
      return null;
    }

    const mediaOption = await this.imageMediaRepository.byId(
      user.profileImageId.id,
    );

    const media = mediaOption.getOrNull();
    if (!media) {
      return null;
    }

    return {
      id: media.id,
      url: media.findUrl(['png_small', 'webp_small', 'original'])!,
    };
  }
}
