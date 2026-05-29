import type { Role } from "../../types/roles";

export interface AgentContext {
  tenantId: string;
  userId: string;
  userRole: Role;
  organizationName?: string;
}
