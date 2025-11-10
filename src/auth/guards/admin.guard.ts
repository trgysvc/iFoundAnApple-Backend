import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AppConfiguration, AuthConfig } from '../../config/configuration';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly adminRoles: string[];

  constructor(private readonly configService: ConfigService<AppConfiguration, true>) {
    const authConfig = this.configService.get<AuthConfig>('auth', { infer: true });
    this.adminRoles = authConfig.adminRoles;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as RequestUser | undefined;

    if (!user || !user.roles.some((role) => this.adminRoles.includes(role))) {
      throw new ForbiddenException('Admin privileges required');
    }

    return true;
  }
}
