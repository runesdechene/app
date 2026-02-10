import { EntityManager } from '@mikro-orm/postgresql';
import { Place } from '../../domain/entities/place.js';
import { NotFoundException } from '../exceptions/not-found-exception.js';

export abstract class PlaceBaseCommandHandler {
  constructor(protected readonly em: EntityManager) {}

  async getPlaceOrThrow(id: string) {
    const place = await this.em.findOne(Place, { id });
    if (!place) {
      throw new NotFoundException('Place not found');
    }

    return place;
  }
}
