import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_ROUTE_KEY } from './public-route.js';
import { Authorizer } from '../services/auth/authorizer/authorizer.js';
import { REQUIRES_GUEST_KEY } from './requires-guest.js';
import { REQUIRES_ADMIN_KEY } from './requires-admin.js';
import { Role } from '../../domain/model/role.js';

@Injectable()
export class AuthorizedGuard implements CanActivate {
  constructor(
    private readonly authorizer: Authorizer,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;

    if (!authorization) return this.isAllowedToGuests(context);
    if (this.requiresGuest(context)) return false;

    const parts = authorization.split(' ');
    const token = parts[1];
    const user = await this.authorizer.check(token);

    if (this.hasMetadata(REQUIRES_ADMIN_KEY, context)) {
      if (user.role() !== Role.ADMIN) {
        return false;
      }
    }

    request.user = user;
    return true;
  }

  private requiresGuest(context: ExecutionContext) {
    return this.hasMetadata(REQUIRES_GUEST_KEY, context);
  }

  private isAllowedToGuests(context: ExecutionContext) {
    return (
      this.hasMetadata(REQUIRES_GUEST_KEY, context) ||
      this.hasMetadata(PUBLIC_ROUTE_KEY, context)
    );
  }

  private hasMetadata(key: string, context: ExecutionContext) {
    return (
      this.reflector.get(key, context.getHandler()) === true ||
      this.reflector.get(key, context.getClass()) === true
    );
  }
}
