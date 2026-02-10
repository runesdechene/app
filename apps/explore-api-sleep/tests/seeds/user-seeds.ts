import { UserBuilder } from '../../src/app/domain/builders/user-builder.js';
import { Role } from '../../src/app/domain/model/role.js';
import { Rank } from '../../src/app/domain/model/rank.js';
import { UserFixture } from '../fixtures/user-fixture.js';
import { AuthFixture } from '../fixtures/auth-fixture.js';

const anthony = new UserBuilder()
  .id('anthony-cyrille')
  .lastName('Cyrille')
  .emailAddress('anthonycyrille@gmail.com')
  .password('azerty')
  .role(Role.ADMIN)
  .rank(Rank.MEMBER);
const johnDoe = new UserBuilder()
  .id('john-doe')
  .lastName('Doe')
  .emailAddress('johndoe@gmail.com')
  .password('azerty')
  .role(Role.USER)
  .rank(Rank.GUEST);
const johnDoe1 = new UserBuilder()
  .id('john-doe1')
  .lastName('Doe')
  .emailAddress('johndoe1@gmail.com')
  .password('azerty')
  .role(Role.USER)
  .rank(Rank.GUEST);
const johnDoe2 = new UserBuilder()
  .id('john-doe2')
  .lastName('Doe')
  .emailAddress('johndoe2@gmail.com')
  .password('azerty')
  .role(Role.USER)
  .rank(Rank.GUEST);
const johnDoe3 = new UserBuilder()
  .id('john-doe3')
  .lastName('Doe')
  .emailAddress('johndoe3@gmail.com')
  .password('azerty')
  .role(Role.USER)
  .rank(Rank.GUEST);
const johnDoe4 = new UserBuilder()
  .id('john-doe4')
  .lastName('Doe')
  .emailAddress('johndoe4@gmail.com')
  .password('azerty')
  .role(Role.USER)
  .rank(Rank.GUEST);

export const userSeeds = {
  anthony: () => new UserFixture(anthony.build()),
  johnDoe: () => new UserFixture(johnDoe.build()),
  johnDoe1: () => new UserFixture(johnDoe1.build()),
  johnDoe2: () => new UserFixture(johnDoe2.build()),
  johnDoe3: () => new UserFixture(johnDoe3.build()),
  johnDoe4: () => new UserFixture(johnDoe4.build()),
};

export const authSeeds = {
  anthony: () => new AuthFixture(anthony.build()),
  johnDoe: () => new AuthFixture(johnDoe.build()),
  johnDoe1: () => new AuthFixture(johnDoe1.build()),
  johnDoe2: () => new AuthFixture(johnDoe2.build()),
  johnDoe3: () => new AuthFixture(johnDoe3.build()),
  johnDoe4: () => new AuthFixture(johnDoe4.build()),
};
