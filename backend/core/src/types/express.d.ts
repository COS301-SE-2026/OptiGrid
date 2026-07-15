//This file just makes all the files automaticlly get user and tenant info
import 'express';
import type { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface User {
      id: string;
      // this is resolved from our own DB in the auth middleware
      roleType: UserRole;
      user_metadata: {
        tenant_id: string;
        [k: string]: any;
      };
      [k: string]: any;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
