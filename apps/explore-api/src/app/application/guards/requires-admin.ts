import { SetMetadata } from '@nestjs/common';

export const REQUIRES_ADMIN_KEY = 'requires-admin';
export const RequiresAdmin = () => SetMetadata(REQUIRES_ADMIN_KEY, true);
