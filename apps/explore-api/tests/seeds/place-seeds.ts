import { userSeeds } from './user-seeds.js';
import { placeTypeSeeds } from './place-type-seeds.js';
import { PlaceFixture } from '../fixtures/place-fixture.js';
import { Place } from '../../src/app/domain/entities/place.js';
import { ref } from '@mikro-orm/core';
import { User } from '../../src/app/domain/entities/user.js';
import { PlaceType } from '../../src/app/domain/entities/place-type.js';

export const placeSeeds = {
  first: () =>
    new PlaceFixture(
      new Place({
        id: 'place-1',
        author: ref(User, userSeeds.anthony().id()),
        placeType: ref(PlaceType, placeTypeSeeds.first().id()),
        title: 'Mont Saint Michel',
        text: 'This is the first place',
        address: '1st Street',
        latitude: 48.64002,
        longitude: -1.51228,
        private: false,
        masked: false,
        images: [],
        createdAt: new Date('2021-01-01'),
        accessibility: 'medium',
        sensible: false,
      }),
    ),
  second: () =>
    new PlaceFixture(
      new Place({
        id: 'place-2',
        author: ref(User, userSeeds.johnDoe().id()),
        placeType: ref(PlaceType, placeTypeSeeds.first().id()),
        title: 'Tour Eiffel',
        text: 'This is the second place',
        address: '2nd Street',
        latitude: 48.86145,
        longitude: 2.29317,
        private: false,
        masked: false,
        images: [],
        createdAt: new Date('2021-01-02'),
        accessibility: null,
        sensible: false,
      }),
    ),
  anthonyPlace: () =>
    new PlaceFixture(
      new Place({
        id: 'place-1',
        author: ref(User, userSeeds.anthony().id()),
        placeType: ref(PlaceType, placeTypeSeeds.first().id()),
        title: 'Mont Saint Michel',
        text: 'This is the first place',
        address: '1st Street',
        latitude: 48.64002,
        longitude: -1.51228,
        private: false,
        masked: false,
        images: [],
        createdAt: new Date('2021-01-01'),
        accessibility: null,
        sensible: false,
      }),
    ),
  johnDoePlace: () =>
    new PlaceFixture(
      new Place({
        id: 'place-2',
        author: ref(User, userSeeds.johnDoe().id()),
        placeType: ref(PlaceType, placeTypeSeeds.first().id()),
        title: 'Tour Eiffel',
        text: 'This is the second place',
        address: '2nd Street',
        latitude: 48.86145,
        longitude: 2.29317,
        private: false,
        masked: false,
        images: [],
        createdAt: new Date('2021-01-02'),
        accessibility: null,
        sensible: false,
      }),
    ),
} as const;
