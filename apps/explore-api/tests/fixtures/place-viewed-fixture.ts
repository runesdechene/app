import { IFixture } from '../config/fixture.interface.js';
import { ITester } from '../config/tester.interface.js';
import {
  I_PLACE_VIEWED_REPOSITORY,
  IPlaceViewedRepository,
} from '../../src/app/application/ports/repositories/place-viewed-repository.js';
import { PlaceViewed } from '../../src/app/domain/entities/place-viewed.js';

export class PlaceViewedFixture implements IFixture {
  constructor(private readonly entity: PlaceViewed) {}

  async load(tester: ITester): Promise<void> {
    const repository = tester.get<IPlaceViewedRepository>(
      I_PLACE_VIEWED_REPOSITORY,
    );
    await repository.save(this.entity);
  }
}
