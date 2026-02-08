import { IFixture } from '../config/fixture.interface.js';
import { ITester } from '../config/tester.interface.js';
import {
  I_PLACE_EXPLORED_REPOSITORY,
  IPlaceExploredRepository,
} from '../../src/app/application/ports/repositories/place-explored-repository.js';
import { PlaceExplored } from '../../src/app/domain/entities/place-explored.js';

export class PlaceExploredFixture implements IFixture {
  constructor(private readonly entity: PlaceExplored) {}

  async load(tester: ITester): Promise<void> {
    const repository = tester.get<IPlaceExploredRepository>(
      I_PLACE_EXPLORED_REPOSITORY,
    );
    await repository.save(this.entity);
  }
}
