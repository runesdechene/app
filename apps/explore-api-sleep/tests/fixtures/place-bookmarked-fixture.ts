import { IFixture } from '../config/fixture.interface.js';
import { ITester } from '../config/tester.interface.js';
import {
  I_PLACE_BOOKMARKED_REPOSITORY,
  IPlaceBookmarkedRepository,
} from '../../src/app/application/ports/repositories/place-bookmarked-repository.js';
import { PlaceBookmarked } from '../../src/app/domain/entities/place-bookmarked.js';

export class PlaceBookmarkedFixture implements IFixture {
  constructor(private readonly entity: PlaceBookmarked) {}

  async load(tester: ITester): Promise<void> {
    const repository = tester.get<IPlaceBookmarkedRepository>(
      I_PLACE_BOOKMARKED_REPOSITORY,
    );
    await repository.save(this.entity);
  }
}
