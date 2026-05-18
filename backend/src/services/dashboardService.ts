import { User, Tenant } from "../models";
import { AppError } from "../utils/AppError";

export interface TenantAnalytics {
  memberCount: number;
  activeMembers: number;
  plan: string;
  tenantName: string;
  tenantSlug: string;
  isActive: boolean;
  recentMembers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    joinedAt: string;
  }>;
}

export async function getTenantAnalytics(
  tenantId: any
): Promise<TenantAnalytics> {

  let realTenantId = tenantId;

if (
  typeof tenantId === "string" &&
  tenantId.includes("_id")
) {

  const match =
    tenantId.match(
      /ObjectId\('([a-f0-9]{24})'\)/
    );

  if (match?.[1]) {

    realTenantId = match[1];
  }

} else if (
  typeof tenantId === "object"
) {

  realTenantId =
    tenantId._id;
}

  const tenant =
    await Tenant.findById(
      realTenantId
    );

  if (!tenant) {

    throw new AppError(

      404,

      "Organization not found",

      "TENANT_NOT_FOUND"
    );
  }

  const [
    memberCount,
    activeMembers,
    recentUsers
  ] = await Promise.all([

    User.countDocuments({
      tenantId: realTenantId
    }),

    User.countDocuments({
      tenantId: realTenantId,
      isActive: true
    }),

    User.find({
      tenantId: realTenantId
    })
      .sort({
        createdAt: -1
      })
      .limit(5)
      .select(
        "firstName lastName role createdAt"
      ),
  ]);

  return {

    memberCount,

    activeMembers,

    plan: tenant.plan,

    tenantName: tenant.name,

    tenantSlug: tenant.slug,

    isActive: tenant.isActive,

    recentMembers:
      recentUsers.map((u) => ({

        id: u._id.toString(),

        firstName: u.firstName,

        lastName: u.lastName,

        role: u.role,

        joinedAt:
          u.createdAt.toISOString(),
      })),
  };
}
