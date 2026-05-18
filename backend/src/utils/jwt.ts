import jwt, {
  SignOptions
} from "jsonwebtoken";

import { env }
from "../config/env";

import type { Role }
from "../types/roles";

export interface AccessTokenPayload {

  sub: string;

  email: string;

  role: Role;

  tenantId: string;
}

export interface RefreshTokenPayload {

  sub: string;

  tenantId: string;
}

export function signAccessToken(
  payload: AccessTokenPayload
): string {

  return jwt.sign(

    payload,

    env.jwt.accessSecret as string,

    {
      expiresIn:
        env.jwt.accessExpiresIn,
    } as SignOptions
  );
}

export function signRefreshToken(
  payload: RefreshTokenPayload
): string {

  return jwt.sign(

    payload,

    env.jwt.refreshSecret as string,

    {
      expiresIn:
        env.jwt.refreshExpiresIn,
    } as SignOptions
  );
}

export function verifyAccessToken(
  token: string
): AccessTokenPayload {

  return jwt.verify(

    token,

    env.jwt.accessSecret as string

  ) as AccessTokenPayload;
}

export function verifyRefreshToken(
  token: string
): RefreshTokenPayload {

  return jwt.verify(

    token,

    env.jwt.refreshSecret as string

  ) as RefreshTokenPayload;
}