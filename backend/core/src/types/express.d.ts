//This file just makes all the files automaticlly get user and tenant info
import 'express';

declare global {
  namespace Express {
    interface User {
      id: string;
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
