import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthRequest, AuthUser } from '../auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<AuthRequest>().user,
);
