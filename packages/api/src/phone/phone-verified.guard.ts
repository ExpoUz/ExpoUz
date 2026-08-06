import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PhoneVerificationService } from './phone-verification.service';

/**
 * Blocks an action unless the authenticated user has a verified phone number.
 * Throws ForbiddenException({ code: 'PHONE_REQUIRED' }) which the client catches
 * to open the phone-capture prompt. Must run AFTER JwtAuthGuard so req.user is set.
 */
@Injectable()
export class PhoneVerifiedGuard implements CanActivate {
  constructor(private readonly phone: PhoneVerificationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    await this.phone.assertVerified(req.user.id);
    return true;
  }
}
