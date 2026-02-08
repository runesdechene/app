import { IFixture } from '../config/fixture.interface.js';
import { ITester } from '../config/tester.interface.js';
import {
  I_PLACE_LIKED_REPOSITORY,
  IPlaceLikedRepository,
} from '../../src/app/application/ports/repositories/place-liked-repository.js';
import { PlaceLiked } from '../../src/app/domain/entities/place-liked.js';

export class PlaceLikedFixture implements IFixture {
  constructor(private readonly entity: PlaceLiked) {}

  async load(tester: ITester): Promise<void> {
    const repository = tester.get<IPlaceLikedRepository>(
      I_PLACE_LIKED_REPOSITORY,
    );
    await repository.save(this.entity);
  }
}
