// src/services/authService.ts

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, Tenant } from "../models";
import { AppError } from "../utils/AppError";

// ── Env ───────────────────────────────────────────────────────────────────────

const JWT_SECRET = (process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET)!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TTL = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
const REFRESH_TTL = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

// ── Wire shape returned to clients ────────────────────────────────────────────

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logo: string | null;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  tenant: TenantSummary;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function issueTokens(userId: string, tenantId: string): TokenPair {
  const payload = { sub: userId, tenantId };
  return {
    accessToken: jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL }),
    refreshToken: jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL }),
  };
}

/**
 * Derives a URL-safe slug from an org name.
 * No external utility needed — keeps authService self-contained.
 * Example: "RKG Labs Inc." → "rkg-labs-inc"
 */
async function buildUniqueSlug(name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")   // non-alphanumeric runs → dash
    .replace(/^-+|-+$/g, "");       // trim leading/trailing dashes

  // Check for collisions and append a numeric suffix if needed
  let slug = base;
  let suffix = 1;
  while (await Tenant.exists({ slug })) {
    slug = `${base}-${suffix}`;
    suffix++;
  }
  return slug;
}

type PopulatedTenant = {
  _id: { toString(): string };
  name: string;
  slug: string;
  plan: string;
  isActive?: boolean;
  logo?: string | null;
};

function formatUser(
  user: {
    _id: { toString(): string };
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  },
  tenant: PopulatedTenant
): AuthUserResponse {
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    tenantId: tenant._id.toString(),
    tenant: {
      id: tenant._id.toString(),
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      logo: tenant.logo ?? null,
    },
  };
}

// ── registerUser ──────────────────────────────────────────────────────────────

export interface RegisterInput {
  firstName: string;
  lastName: string;
  organizationName: string;
  email: string;
  password: string;
  /**
   * Optional base64 data-URL for the organization logo uploaded during signup.
   * This is the org's OWN logo — separate from the fixed Govinda AI product logo.
   */
  organizationLogo?: string;
}

export async function registerUser(
  input: RegisterInput
): Promise<{ user: AuthUserResponse; tokens: TokenPair }> {
  const { firstName, lastName, organizationName, email, password, organizationLogo } = input;

  // ── Logo validation ──────────────────────────────────────────────────────
  if (organizationLogo != null) {
    if (typeof organizationLogo !== "string" || !organizationLogo.startsWith("data:image/")) {
      throw new AppError(400, "Logo must be a valid image data-URL", "INVALID_LOGO");
    }
    if (organizationLogo.length > 2_800_000) {
      throw new AppError(400, "Logo image is too large. Max 2 MB.", "LOGO_TOO_LARGE");
    }
  }

  // ── Duplicate email check ────────────────────────────────────────────────
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new AppError(409, "Email already registered", "EMAIL_EXISTS");
  }

  // ── Create Tenant ────────────────────────────────────────────────────────
  const slug = await buildUniqueSlug(organizationName);
  const tenant = await Tenant.create({
    name: organizationName.trim(),
    slug,
    plan: "free",
    ...(organizationLogo ? { logo: organizationLogo } : {}),
  });

  // ── Create admin User ────────────────────────────────────────────────────
  const hashed = await bcrypt.hash(password, 12);
  const user = await User.create({
    email: email.toLowerCase().trim(),
    password: hashed,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    role: "tenant_admin",
    tenantId: tenant._id,
    isActive: true,
  });

  const tokens = issueTokens(user._id.toString(), tenant._id.toString());

  return { user: formatUser(user, tenant), tokens };
}

// ── loginUser ─────────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
}

export async function loginUser(
  input: LoginInput
): Promise<{ user: AuthUserResponse; tokens: TokenPair }> {
  const { email, password } = input;

  // Both `password` and `refreshTokenHash` have select:false in the schema.
  // Must opt back in explicitly or bcrypt.compare gets undefined.
  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    isActive: true,
  })
    .select("+password +refreshTokenHash")
    .populate("tenantId", "name slug plan isActive logo");

  if (!user) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const valid = await bcrypt.compare(password, user.password as string);
  if (!valid) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const tenant = user.tenantId as unknown as PopulatedTenant;
  if (!tenant.isActive) {
    throw new AppError(403, "Organization is inactive", "ORG_INACTIVE");
  }

  const tokens = issueTokens(user._id.toString(), tenant._id.toString());

  // Store hashed refresh token — IUser field is `refreshTokenHash`
  const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
  await User.findByIdAndUpdate(user._id, { refreshTokenHash: refreshHash });

  return { user: formatUser(user, tenant), tokens };
}

// ── getCurrentUser ────────────────────────────────────────────────────────────

export async function getCurrentUser(userId: string): Promise<AuthUserResponse> {
  const user = await User.findById(userId).populate(
    "tenantId",
    "name slug plan isActive logo"  // `logo` must always be in this select string
  );

  if (!user || !user.isActive) {
    throw new AppError(404, "User not found", "USER_NOT_FOUND");
  }

  const tenant = user.tenantId as unknown as PopulatedTenant;
  return formatUser(user, tenant);
}

// ── refreshAccessToken ────────────────────────────────────────────────────────

export async function refreshAccessToken(token: string): Promise<TokenPair> {
  let payload: { sub: string; tenantId: string };
  try {
    payload = jwt.verify(token, JWT_REFRESH_SECRET) as typeof payload;
  } catch {
    throw new AppError(401, "Invalid refresh token", "INVALID_TOKEN");
  }

  const user = await User.findById(payload.sub).select("+refreshTokenHash");
  if (!user || !user.refreshTokenHash) {
    throw new AppError(401, "Refresh token revoked", "TOKEN_REVOKED");
  }

  // Validate against the stored hash
  const valid = await bcrypt.compare(token, user.refreshTokenHash as string);
  if (!valid) {
    throw new AppError(401, "Refresh token revoked", "TOKEN_REVOKED");
  }

  const tokens = issueTokens(payload.sub, payload.tenantId);

  // Rotate: store new hash
  const newHash = await bcrypt.hash(tokens.refreshToken, 10);
  await User.findByIdAndUpdate(user._id, { refreshTokenHash: newHash });

  return tokens;
}

// ── logoutUser ────────────────────────────────────────────────────────────────

export async function logoutUser(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
}