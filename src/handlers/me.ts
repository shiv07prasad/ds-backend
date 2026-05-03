import type { Env } from "../types";
import { jsonResponse, parseJsonBody } from "../utils/http";
import { getAuthedUser } from "../utils/auth";
import { findUserNameConflict, updateUserByEmail } from "../db/users";

export async function handleGetMe(request: Request, env: Env) {
  const auth = await getAuthedUser(request, env);
  if ("response" in auth) {
    return auth.response;
  }

  return jsonResponse(200, { user: auth.user });
}

export async function handlePatchMe(request: Request, env: Env) {
  const auth = await getAuthedUser(request, env);
  if ("response" in auth) {
    return auth.response;
  }

  let payload: { name?: string; user_name?: string } = {};
  try {
    payload = await parseJsonBody(request);
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : null;
  const userName =
    typeof payload.user_name === "string" ? payload.user_name.trim() : null;

  if (!name && !userName) {
    return jsonResponse(400, { error: "no_updates" });
  }

  const email = auth.user.email;
  if (userName) {
    const conflict = await findUserNameConflict(env, userName, email);
    if (conflict) {
      return jsonResponse(409, { error: "user_name_taken" });
    }
  }

  const updated = await updateUserByEmail(env, email, name, userName);
  return jsonResponse(200, { user: updated });
}
