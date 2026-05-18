import type { Role } from "./roles";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;
        tenantId: string;
      };
      tenantId?: string;
    }
  }
}

export {};
