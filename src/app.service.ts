import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from './auth/interfaces/request-user.interface';

@Injectable()
export class AppService {
  extractUserFromRequest(request: Request): RequestUser {
    return request.user as RequestUser;
  }
}


