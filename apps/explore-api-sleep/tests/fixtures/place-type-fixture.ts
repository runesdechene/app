import { IFixture } from '../config/fixture.interface.js';
import { ITester } from '../config/tester.interface.js';
import {
  I_PLACE_TYPE_REPOSITORY,
  IPlaceTypeRepository,
} from '../../src/app/application/ports/repositories/place-type-repository.js';
import { PlaceType } from '../../src/app/domain/entities/place-type.js';

export class PlaceTypeFixture implements IFixture {
  constructor(private readonly entity: PlaceType) {}

  async load(tester: ITester): Promise<void> {
    const repository = tester.get<IPlaceTypeRepository>(
      I_PLACE_TYPE_REPOSITORY,
    );
    await repository.save(this.entity);
  }

  raw() {
    return this.entity;
  }

  id() {
    return this.entity.id;
  }
}
