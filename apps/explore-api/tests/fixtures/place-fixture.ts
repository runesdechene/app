import { IFixture } from '../config/fixture.interface.js';
import { ITester } from '../config/tester.interface.js';
import {
  I_PLACE_REPOSITORY,
  IPlaceRepository,
} from '../../src/app/application/ports/repositories/place-repository.js';
import { Place } from '../../src/app/domain/entities/place.js';

export class PlaceFixture implements IFixture {
  constructor(private readonly entity: Place) {}

  async load(tester: ITester): Promise<void> {
    const repository = tester.get<IPlaceRepository>(I_PLACE_REPOSITORY);
    await repository.save(this.entity);
  }

  raw() {
    return this.entity;
  }

  id() {
    return this.entity.id;
  }
}
