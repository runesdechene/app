import { Entity, ManyToOne, Property, Ref } from '@mikro-orm/core';
import { SqlEntity } from '../../../adapters/for-production/database/sql-entity.js';
import { ImageMedia } from './image-media.js';
import { Nullable } from '../../libs/shared/types.js';
import { Role } from '../model/role.js';
import { Rank } from '../model/rank.js';
import { Gender } from '../model/gender.js';
import { IPasswordStrategy } from '../../application/services/auth/password-strategy/password-strategy.interface.js';
import { BadRequestException } from '../../libs/exceptions/bad-request-exception.js';
import { MemberCode } from './member-code.js';

type Props = {
  id: string;
  emailAddress: string;
  password: string;
  lastName: string;
  role: string;
  rank: string;
  gender: Nullable<string>;
  biography: string;
  instagramId: string;
  websiteUrl: string;
  lastAccess?: Date;
  lastDeviceOs?: string;
  lastDeviceVersion?: string;
};

@Entity({ tableName: 'users' })
export class User extends SqlEntity<Props> {
  @Property({ unique: true })
  emailAddress: string;

  // Note
  // In Wanderers, some users had no passwords set, for an unknown reasons
  // This amount to 366 users which is an important number
  // So we prepare a system for these people to set a password when they log in
  @Property({ nullable: true })
  password: Nullable<string>;

  @Property()
  firstName?: string;

  @Property()
  lastName: string;

  @Property({ type: 'string', nullable: true })
  gender: Nullable<Gender>;

  @Property()
  biography: string;

  @Property({ type: 'string' })
  role: Role;

  @Property({ type: 'string' })
  rank: Rank;

  @ManyToOne({
    entity: () => ImageMedia,
    ref: true,
    nullable: true,
    name: 'profile_image_id',
  })
  profileImageId: Nullable<Ref<ImageMedia>>;

  @Property({ nullable: true })
  instagramId: Nullable<string>;

  @Property({ nullable: true })
  websiteUrl: Nullable<string>;

  @Property({ nullable: true })
  lastAccess: Date;

  @Property({ nullable: true })
  lastDeviceOs: string;

  @Property({ nullable: true })
  lastDeviceVersion: string;

  static async register(props: {
    id: string;
    emailAddress: string;
    password: string;
    rank: Rank;
    gender: Gender;
    lastName: string;
    passwordStrategy: IPasswordStrategy;
  }) {
    const user = new User();
    user.id = props.id;
    user.emailAddress = props.emailAddress;
    user.password = await props.passwordStrategy.hash(props.password);
    user.role = Role.USER;
    user.rank = props.rank;
    user.gender = props.gender;
    user.firstName = '';
    user.lastName = props.lastName;
    user.profileImageId = null;
    user.biography = '';
    user.instagramId = '';
    user.websiteUrl = '';
    user.lastAccess = new Date();
    user.lastDeviceOs = '';
    user.lastDeviceVersion = '';

    return user;
  }

  isPasswordValid(strategy: IPasswordStrategy, password: string) {
    if (!this.password) {
      throw BadRequestException.create(
        'NO_PASSWORD',
        'User has no password set',
      );
    }

    return strategy.equals(password, this.password);
  }

  isMember() {
    return this.rank === Rank.MEMBER;
  }

  isUser() {
    return this.role === Role.USER;
  }

  async changePassword(password: string, passwordStrategy: IPasswordStrategy) {
    this.password = await passwordStrategy.hash(password);
  }

  activate(code: MemberCode) {
    if (this.isMember()) {
      throw BadRequestException.create(
        'ALREADY_MEMBER',
        'User is already a member',
      );
    }

    if (code.isConsumed) {
      throw BadRequestException.create(
        'INVALID_MEMBER_CODE',
        'Invalid member code',
      );
    }

    code.consume(this.id);

    this.rank = Rank.MEMBER;
  }

  adminUpdate(
    delta: Partial<{
      emailAddress: string;
      role: Role;
      rank: Rank;
      lastName: string;
    }>,
  ) {
    Object.assign(this, delta);
  }

  update(
    delta: Partial<{
      lastName: string;
      gender: Nullable<Gender>;
      profileImageId: Nullable<string>;
      biography: string;
      instagramUrl: string;
      websiteUrl: string;
      lastAccess?: Date;
      lastDeviceOs?: string;
      lastDeviceVersion?: string;
    }>,
  ) {
    Object.assign(this, delta);
  }

  changeEmailAddress(emailAddress: string) {
    this.emailAddress = emailAddress;
  }

  isAdmin() {
    return this.role === Role.ADMIN;
  }
}
