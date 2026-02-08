import { Command, CommandRunner } from 'nest-commander';
import { Inject } from '@nestjs/common';
import { CreateRequestContext, EntityManager } from '@mikro-orm/postgresql';
import knex from 'knex';
import { ref } from '@mikro-orm/core';

import { LocalConfig } from '../services/shared/local-config/local-config.js';
import { PlaceViewed } from '../../domain/entities/place-viewed.js';
import { Place } from '../../domain/entities/place.js';
import { User } from '../../domain/entities/user.js';
import { PlaceLiked } from '../../domain/entities/place-liked.js';
import { PlaceExplored } from '../../domain/entities/place-explored.js';
import { PlaceBookmarked } from '../../domain/entities/place-bookmarked.js';

@Command({
  name: 'import-places-actions',
  description: 'Import places actions (bookmark, views...)',
})
export class ImportPlaceActionsCli extends CommandRunner {
  constructor(
    @Inject(EntityManager)
    private readonly em: EntityManager,
    @Inject(LocalConfig)
    private readonly config: LocalConfig,
  ) {
    super();
  }

  private db: knex.Knex;
  private placeIds: string[] = [];
  private userIds: string[] = [];

  @CreateRequestContext()
  async run(passedParam: string[], options?: any) {
    this.db = knex.knex({
      client: 'mysql',
      connection: {
        host: this.config.getOrThrow('WANDERERS_DB_HOST'),
        port: this.config.getOrThrow('WANDERERS_DB_PORT'),
        user: this.config.getOrThrow('WANDERERS_DB_NAME'),
        password: this.config.getOrThrow('WANDERERS_DB_PASSWORD'),
        database: this.config.getOrThrow('WANDERERS_DB_NAME'),
      },
    });

    const existingPlaces = await this.em
      .createQueryBuilder(Place)
      .select('id')
      .getResultList();

    this.placeIds = existingPlaces.map((place) => place.id);

    const existingUsers = await this.em
      .createQueryBuilder(User)
      .select('id')
      .getResultList();

    this.userIds = existingUsers.map((user) => user.id);

    try {
      await this.work();
      await this.em.flush();
    } catch (e) {
      console.error(e);
    }

    await this.db.destroy();
  }

  private async work() {
    const legacyActions = await this.db('place_user_action');

    legacyActions.forEach((data) => {
      if (
        !this.placeIds.includes(data.placeId) ||
        !this.userIds.includes(data.createdById)
      ) {
        return;
      }

      switch (data.action) {
        case 'view': {
          this.em.persist(
            new PlaceViewed({
              id: data.id,
              place: ref(this.em.getReference(Place, data.placeId)),
              user: ref(this.em.getReference(User, data.createdById)),
              createdAt: new Date(data.createdAt),
              updatedAt: new Date(data.createdAt),
            }),
          );
          break;
        }
        case 'like': {
          this.em.persist(
            new PlaceLiked({
              id: data.id,
              place: ref(this.em.getReference(Place, data.placeId)),
              user: ref(this.em.getReference(User, data.createdById)),
              createdAt: new Date(data.createdAt),
              updatedAt: new Date(data.createdAt),
            }),
          );
          break;
        }
        case 'visit': {
          this.em.persist(
            new PlaceExplored({
              id: data.id,
              place: ref(this.em.getReference(Place, data.placeId)),
              user: ref(this.em.getReference(User, data.createdById)),
              createdAt: new Date(data.createdAt),
              updatedAt: new Date(data.createdAt),
            }),
          );
          break;
        }
      }
    });

    const bookmarks = await this.db('place_bookmark');

    bookmarks.forEach((data) => {
      if (
        !this.placeIds.includes(data.placeId) ||
        !this.userIds.includes(data.userId)
      ) {
        return;
      }

      this.em.persist(
        new PlaceBookmarked({
          id: data.id,
          place: ref(this.em.getReference(Place, data.placeId)),
          user: ref(this.em.getReference(User, data.userId)),
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.createdAt),
        }),
      );
    });
  }
}
