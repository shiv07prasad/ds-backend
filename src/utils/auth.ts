import type { Env } from "../types";
import { ensureUser } from "../db/users";
import { jsonResponse } from "./http";

function getAccessEmail(request: Request) {
  return request.headers.get("cf-access-authenticated-user-email");
}

function getDevEmail(request: Request) {
  return request.headers.get("x-dev-user-email") || "dev@local";
}

function isLocalRequest(request: Request) {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export async function getAuthedUser(request: Request, env: Env) {
  const email = getAccessEmail(request);
  if (!email) {
    if (isLocalRequest(request)) {
      const devEmail = getDevEmail(request);
      const user = await ensureUser(env, devEmail);
      return { user } as const;
    }
    return { response: jsonResponse(401, { error: "unauthorized" }) } as const;
  }

  const user = await ensureUser(env, email);
  return { user } as const;
}
