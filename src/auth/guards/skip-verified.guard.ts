// src/common/decorators/skip-verified.guard.ts
import { SetMetadata } from '@nestjs/common';

export const SKIP_VERIFIED_GUARD_KEY = 'skipVerifiedGuard';
export const SkipVerifiedGuard = () =>
  SetMetadata(SKIP_VERIFIED_GUARD_KEY, true);
