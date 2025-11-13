import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SupabaseJwtGuard } from './supabase-jwt.guard';

@Injectable()
export class JwtAuthGuard extends SupabaseJwtGuard {
  constructor(
    supabaseService: SupabaseService,
    authService: AuthService,
    private readonly reflector: Reflector,
  ) {
    super(supabaseService, authService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
