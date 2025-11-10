import { Request } from 'express';

export type UserRole = string;

export interface RequestUser {
  id: string;
  email: string;
  roles: UserRole[];
  appMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}
