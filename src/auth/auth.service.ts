import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@supabase/supabase-js';
import { AppConfiguration, AuthConfig } from '../config/configuration';
import { SupabaseService } from '../supabase/supabase.service';
import { RequestUser, UserRole } from './interfaces/request-user.interface';

interface CachedUser {
  value: RequestUser;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly cache = new Map<string, CachedUser>();
  private readonly authConfig: AuthConfig;

  constructor(
    private readonly supabaseService: SupabaseService,
    configService: ConfigService<AppConfiguration, true>,
  ) {
    this.authConfig = configService.get<AuthConfig>('auth', { infer: true });
  }

  async validateUser(userId: string): Promise<RequestUser> {
    const cached = this.cache.get(userId);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const user = await this.supabaseService.getUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.ensureUserIsActive(user);

    const requestUser: RequestUser = {
      id: user.id,
      email: user.email ?? '',
      roles: this.extractRoles(user),
      appMetadata: user.app_metadata ?? {},
      userMetadata: user.user_metadata ?? {},
    };

    this.cache.set(userId, {
      value: requestUser,
      expiresAt: now + this.authConfig.cacheTtlSeconds * 1000,
    });

    return requestUser;
  }

  private extractRoles(user: User): UserRole[] {
    const roles = new Set<UserRole>();
    const rawRoles = user.app_metadata?.roles;

    if (Array.isArray(rawRoles)) {
      rawRoles.filter(Boolean).forEach((role) => roles.add(String(role)));
    } else if (typeof rawRoles === 'string') {
      rawRoles
        .split(',')
        .map((role) => role.trim())
        .filter((role) => role.length > 0)
        .forEach((role) => roles.add(role));
    }

    if (typeof user.app_metadata?.role === 'string') {
      roles.add(user.app_metadata.role);
    }

    if (roles.size === 0) {
      roles.add('user');
    }

    return Array.from(roles);
  }

  private ensureUserIsActive(user: User): void {
    const bannedUntil = (user as { banned_until?: string }).banned_until;
    if (bannedUntil && new Date(bannedUntil) > new Date()) {
      this.logger.warn(`Blocked banned user ${user.id} attempted access.`);
      throw new ForbiddenException('Account is temporarily suspended');
    }

    if (!user.email_confirmed_at) {
      throw new ForbiddenException('Email address not verified');
    }
  }
}
