import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfiguration, AuthConfig } from '../../config/configuration';
import { AuthService } from '../auth.service';
import { RequestUser } from '../interfaces/request-user.interface';

interface SupabaseJwtPayload {
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  iss?: string;
  email?: string;
  [key: string]: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  constructor(
    configService: ConfigService<AppConfiguration, true>,
    private readonly authService: AuthService,
  ) {
    const authConfig = configService.get<AuthConfig>('auth', { infer: true });
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      audience: authConfig.audience,
      issuer: authConfig.issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: authConfig.jwksUrl,
      }),
    });
  }

  async validate(payload: SupabaseJwtPayload): Promise<RequestUser> {
    if (!payload?.sub) {
      this.logger.warn('JWT payload missing subject (sub).');
      throw new UnauthorizedException('Invalid Supabase token');
    }

    return this.authService.validateUser(payload.sub);
  }
}
