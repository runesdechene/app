import { Command, CommandRunner } from 'nest-commander';
import { Inject } from '@nestjs/common';
import { CreateRequestContext, EntityManager } from '@mikro-orm/postgresql';
import knex from 'knex';
import { ref } from '@mikro-orm/core';

import { LocalConfig } from '../services/shared/local-config/local-config.js';
import { PlaceType } from '../../domain/entities/place-type.js';
import { Place } from '../../domain/entities/place.js';
import { User } from '../../domain/entities/user.js';
import { sanitizeString } from '../../libs/utils/sanitize-string.js';
import { sanitizeLongText } from '../../libs/utils/sanitize-long-text.js';

@Command({
  name: 'import-places',
  description: 'Import places',
})
export class ImportPlacesCli extends CommandRunner {
  constructor(
    @Inject(EntityManager)
    private readonly em: EntityManager,
    @Inject(LocalConfig)
    private readonly config: LocalConfig,
  ) {
    super();
  }

  private db: knex.Knex;
  private placeTypes: Record<string, PlaceType> = {};

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

    try {
      await this.work();
    } catch (e) {
      console.error(e);
    }

    await this.db.destroy();
  }

  private async work() {
    const legacyPlaces = await this.db('place')
      .select([
        'place.*',
        'place_type.*',
        'place_translation.*',
        'place_type_translation.*',
        'user.id',
      ])
      .leftJoin('place_type', 'place_type.id', 'place.placeTypeId')
      .leftJoin('user', 'user.id', 'place.createdById')
      .leftJoin(
        this.db('place_translation')
          .as('place_translation')
          .where('place_translation.lang', 'fr'),
        'place_translation.placeId',
        'place.id',
      )
      .leftJoin(
        this.db('place_type_translation')
          .as('place_type_translation')
          .where('place_type_translation.lang', 'fr'),
        'place_type_translation.placeTypeId',
        'place_type.id',
      )
      .options({ nestTables: true });

    let i = 0;
    for (const legacyPlace of legacyPlaces) {
      if (i % 50 === 0) {
        const percentage = (i / legacyPlaces.length) * 100;
        console.log(`Importing places: ${percentage.toFixed(2)}%`);
      }

      await this.createNewPlace(legacyPlace);
      i++;
    }

    this.ensurePlaceColors();

    console.log('persisting...');
    await this.em.flush();

    console.log('done');
  }

  private async createNewPlace(data: any) {
    this.ensurePlaceType(data);

    const images = await this.db('place_image').where('placeId', data.place.id);

    const place = data.place;
    let translations = data.place_translation;

    if (!translations?.title) {
      translations = await this.db('place_translation')
        .where('placeId', place.id)
        .first();

      if (!translations) {
        return;
      }
    }
    const refAuthor = ref(User, place.createdById);
    if (!refAuthor) return;
    const refPlaceType = ref(PlaceType, place.placeTypeId);
    if (!refPlaceType) return;

    const mikroPlace = new Place({
      id: data.place.id,
      author: refAuthor,
      placeType: refPlaceType,
      title: sanitizeString(translations.title),
      text: sanitizeLongText(translations.text),
      address: sanitizeString(place.address),
      latitude: place.latitude,
      longitude: place.longitude,
      private: place.private === 1,
      masked: place.masked === 1,
      images: images.map((image: any) => ({
        id: image.id,
        url: image.url,
      })),
      accessibility: null,
      sensible: false,
      createdAt: new Date(place.createdAt),
      updatedAt: new Date(place.createdAt),
    });

    this.em.persist(mikroPlace);
  }

  private ensurePlaceType(data: any) {
    const placeType = data.place_type;
    const placeTypeTranslation = data.place_type_translation;

    const refParent = ref(PlaceType, placeType.parentId);
    if (!refParent) return;

    if (!this.placeTypes[placeType.id]) {
      this.placeTypes[placeType.id] = new PlaceType({
        id: placeType.id,
        parent: refParent,
        title: sanitizeString(placeTypeTranslation.name),
        formDescription: sanitizeLongText(placeTypeTranslation.formDesc),
        longDescription: sanitizeLongText(placeTypeTranslation.longDesc),
        images: {
          background: placeType.backgroundImageURL,
          regular: placeType.imageURL,
          map: placeType.mapImageURL,
        },
        color: placeType.color,
        background: placeType.background,
        border: placeType.border,
        fadedColor: placeType.fadedColor,
        order: placeType.order,
        hidden: false,
      });

      this.em.persist(this.placeTypes[placeType.id]);
    }
  }

  private ensurePlaceColors() {
    Object.entries(this.placeTypes).forEach(([id, placeType]) => {
      if (placeType.parent) {
        const parent = this.placeTypes[placeType.parent.id];
        placeType.color = parent.color;
      }
    });
  }
}
