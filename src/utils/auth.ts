import type { Env } from "../types";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ensureUser } from "../db/users";
import { jsonResponse } from "./http";

let cachedJwksUrl = "";
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getDevEmail(request: Request) {
  return request.headers.get("x-dev-user-email");
}

function isLocalRequest(request: Request) {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function getJwks(jwksUrl: string) {
  if (!cachedJwks || cachedJwksUrl !== jwksUrl) {
    cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
    cachedJwksUrl = jwksUrl;
  }
  return cachedJwks;
}

async function getClerkEmail(token: string, env: Env) {
  if (!env.CLERK_JWKS_URL || !env.CLERK_ISSUER) {
    return null;
  }

  const { payload } = await jwtVerify(token, getJwks(env.CLERK_JWKS_URL), {
    issuer: env.CLERK_ISSUER,
  });

  if (typeof payload.email === "string") {
    return payload.email;
  }

  if (typeof payload.email_address === "string") {
    return payload.email_address;
  }

  return null;
}

export async function getAuthedUser(request: Request, env: Env) {
  const token = getBearerToken(request);
  if (!token) {
    if (isLocalRequest(request)) {
      const devEmail = getDevEmail(request);
      if (devEmail) {
        const user = await ensureUser(env, devEmail);
        return { user } as const;
      }
    }

    return { response: jsonResponse(401, { error: "unauthorized" }) } as const;
  }

  try {
    const email = await getClerkEmail(token, env);
    if (!email) {
      return {
        response: jsonResponse(401, { error: "email_missing" }),
      } as const;
    }

    const user = await ensureUser(env, email);
    return { user } as const;
  } catch {
    return { response: jsonResponse(401, { error: "unauthorized" }) } as const;
  }
}
