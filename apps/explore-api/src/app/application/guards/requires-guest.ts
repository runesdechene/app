import { SetMetadata } from '@nestjs/common';

// Indicates that the query requires the user NOT to be authenticated
export const REQUIRES_GUEST_KEY = 'requires-guest';
export const RequiresGuest = () => SetMetadata(REQUIRES_GUEST_KEY, true);
