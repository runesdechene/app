import { PlaceTypeFixture } from '../fixtures/place-type-fixture.js';
import { PlaceType } from '../../src/app/domain/entities/place-type.js';

export const placeTypeSeeds = {
  first: () =>
    new PlaceTypeFixture(
      new PlaceType({
        id: 'place-type-1',
        parent: null,
        title: 'Place Type 1',
        formDescription: 'This is the first place type',
        longDescription: 'This is the first place type',
        images: {
          background: 'background.jpg',
          regular: 'regular.jpg',
          map: 'map.jpg',
        },
        color: '#000000',
        border: '#000000',
        background: '#000000',
        fadedColor: '#000000',
        order: 1,
        hidden: false,
      }),
    ),
  second: () =>
    new PlaceTypeFixture(
      new PlaceType({
        id: 'place-type-2',
        parent: null,
        title: 'Place Type 2',
        formDescription: 'This is the second place type',
        longDescription: 'This is the second place type',
        images: {
          background: 'background.jpg',
          regular: 'regular.jpg',
          map: 'map.jpg',
        },
        color: '#000000',
        border: '#000000',
        background: '#000000',
        fadedColor: '#000000',
        order: 2,
        hidden: false,
      }),
    ),
} as const;
