import { Rank } from './rank.js';
import { Role } from './role.js';
import { User } from '../entities/user.js';

export class AuthContext {
  constructor(
    private readonly props: {
      userId: string;
      emailAddress: string;
      role: Role;
      rank: Rank;
    },
  ) {}

  static fromUser(user: User) {
    return new AuthContext({
      userId: user.id,
      emailAddress: user.emailAddress,
      role: user.role,
      rank: user.rank,
    });
  }

  id() {
    return this.props.userId;
  }

  emailAddress() {
    return this.props.emailAddress;
  }

  role() {
    return this.props.role;
  }

  rank() {
    return this.props.rank;
  }

  is(id: string) {
    return this.props.userId === id;
  }

  IsOwnerOrAdmin(id: string) {
    return this.is(id) || this.role() === Role.ADMIN;
  }
}
