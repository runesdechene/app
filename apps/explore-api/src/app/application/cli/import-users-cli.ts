import { Command, CommandRunner } from 'nest-commander';
import { Inject } from '@nestjs/common';
import { CreateRequestContext, EntityManager } from '@mikro-orm/postgresql';
import knex from 'knex';
import { ref } from '@mikro-orm/core';
import axios from 'axios';
import sharp from 'sharp';
import { LocalConfig } from '../services/shared/local-config/local-config.js';
import { User } from '../../domain/entities/user.js';
import { Nullable } from '../../libs/shared/types.js';
import { Role } from '../../domain/model/role.js';
import {
  availableVariants,
  ImageMedia,
} from '../../domain/entities/image-media.js';
import { RandomIdProvider } from '../../../adapters/for-production/services/random-id-provider.js';
import { sanitizeString } from '../../libs/utils/sanitize-string.js';
import { sanitizeLongText } from '../../libs/utils/sanitize-long-text.js';

type LegacyUser = {
  id: string;
  name: string;
  emailAddress: string;
  password: string;
  avatar: Nullable<string>;
  role: string;
  biography: string;
};

@Command({
  name: 'import-users',
  description: 'Import users',
})
export class ImportUsersCli extends CommandRunner {
  constructor(
    @Inject(EntityManager)
    private readonly em: EntityManager,
    @Inject(LocalConfig)
    private readonly config: LocalConfig,
  ) {
    super();
  }

  @CreateRequestContext()
  async run(passedParam: string[], options?: any) {
    const db = knex.knex({
      client: 'mysql',
      connection: {
        host: this.config.getOrThrow('WANDERERS_DB_HOST'),
        port: this.config.getOrThrow('WANDERERS_DB_PORT'),
        user: this.config.getOrThrow('WANDERERS_DB_NAME'),
        password: this.config.getOrThrow('WANDERERS_DB_PASSWORD'),
        database: this.config.getOrThrow('WANDERERS_DB_NAME'),
      },
    });

    const legacyUsers = await db
      .queryBuilder()
      .select([
        'id',
        'name',
        'emailAddress',
        'password',
        'avatar',
        'role',
        'biography',
      ])
      .from('user');

    const appUsers = await this.em.find(User, {});

    await Promise.allSettled(
      legacyUsers.map(async (legacyUser) => {
        const appUser = appUsers.find(
          (user) => user.emailAddress === legacyUser.emailAddress,
        );

        try {
          if (appUser) {
            return this.mergeUsers(legacyUser, appUser);
          } else {
            return this.createNewUser(legacyUser);
          }
        } catch (e) {
          console.error(e);
          throw e;
        }
      }),
    );

    await this.em.flush();

    console.log('Done !');

    await db.destroy();
  }

  private async mergeUsers(legacyUser: LegacyUser, appUser: User) {
    this.em.persist(appUser);
    await this.updateProfileImage(legacyUser, appUser);
  }

  private async createNewUser(legacyUser: LegacyUser) {
    const newUser = new User({
      id: legacyUser.id,
      emailAddress: sanitizeString(legacyUser.emailAddress),
      password: legacyUser.password,
      lastName: '',
      role: Role.USER,
      rank: legacyUser.role,
      gender: null,
      biography: sanitizeLongText(legacyUser.biography) ?? '',
    });

    this.em.persist(newUser);
    await this.updateProfileImage(legacyUser, newUser);
  }

  private async getMetadata(legacyUser: LegacyUser) {
    if (!legacyUser.avatar) {
      return null;
    }

    const response = await axios.get(legacyUser.avatar, {
      responseType: 'arraybuffer',
    });
    const buffer = Buffer.from(response.data, 'utf-8');
    const image = sharp(buffer);
    const metadata = await image.metadata();

    return {
      url: legacyUser.avatar,
      height: metadata.height ?? 0,
      width: metadata.width ?? 0,
      size: metadata.size ?? 0,
    };
  }

  private async updateProfileImage(legacyUser: LegacyUser, appUser: User) {
    if (appUser.profileImageId) {
      return;
    }

    const metadata = await this.getMetadata(legacyUser);
    if (metadata) {
      const image = new ImageMedia({
        id: RandomIdProvider.getId(),
        user: ref(appUser),
        variants: availableVariants.map((name) => ({
          name,
          url: metadata.url,
          height: metadata.height,
          width: metadata.width,
          size: metadata.size,
        })),
      });

      appUser.profileImageId = ref(image);
      this.em.persist(image);
    }
  }
}
