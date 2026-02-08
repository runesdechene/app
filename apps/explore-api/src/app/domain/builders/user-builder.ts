import { Role } from '../model/role.js';
import { Rank } from '../model/rank.js';
import { Gender } from '../model/gender.js';
import { RandomIdProvider } from '../../../adapters/for-production/services/random-id-provider.js';
import { User } from '../entities/user.js';

export class UserBuilder {
  private readonly _props: Partial<User>;

  constructor(props?: Partial<User>) {
    this._props = {
      id: RandomIdProvider.getId(),
      emailAddress: 'johndoe@gmail.com',
      password: 'azerty',
      role: Role.USER,
      rank: Rank.GUEST,
      gender: Gender.MALE,
      lastName: 'Doe',
      profileImageId: null,
      biography: '',
      ...props,
    };
  }

  id(id: string) {
    this._props.id = id;
    return this;
  }

  emailAddress(emailAddress: string) {
    this._props.emailAddress = emailAddress;
    return this;
  }

  password(password: string) {
    this._props.password = password;
    return this;
  }

  role(role: Role) {
    this._props.role = role;
    return this;
  }

  rank(rank: Rank) {
    this._props.rank = rank;
    return this;
  }

  lastName(name: string) {
    this._props.lastName = name;
    return this;
  }

  gender(gender: Gender) {
    this._props.gender = gender;
    return this;
  }

  build() {
    const user = new User();
    Object.assign(user, this._props);

    return user;
  }
}
