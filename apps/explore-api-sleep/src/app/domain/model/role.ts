export enum Role {
  USER = 'user',
  ADMIN = 'admin',
}

const roleMap = {
  [Role.USER]: 100,
  [Role.ADMIN]: 200,
} as const;

export class RoleUtils {
  static toValue(role: Role) {
    return roleMap[role];
  }
}
