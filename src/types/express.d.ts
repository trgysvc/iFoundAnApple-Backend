import 'express';
import { RequestUser } from '../auth/interfaces/request-user.interface';

declare module 'express-serve-static-core' {
  interface Request {
    user?: RequestUser;
  }
}
