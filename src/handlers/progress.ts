import type { Env } from "../types";
import { jsonResponse, parseJsonBody } from "../utils/http";
import { getAuthedUser } from "../utils/auth";

type ProgressRow = {
  subtopic_id: number;
  is_done: number;
};

export async function handleGetMyProgress(request: Request, env: Env) {
  const auth = await getAuthedUser(request, env);
  if ("response" in auth) {
    return auth.response;
  }

  const rows = await env.DB.prepare(
    "SELECT subtopic_id, is_done FROM user_progress WHERE user_id = ?",
  )
    .bind(auth.user.id)
    .all<ProgressRow>();

  return jsonResponse(200, { progress: rows.results ?? [] });
}

export async function handleUpdateMyProgress(
  request: Request,
  env: Env,
  subtopicId: number,
) {
  const auth = await getAuthedUser(request, env);
  if ("response" in auth) {
    return auth.response;
  }

  let payload: { is_done?: boolean } = {};
  try {
    payload = await parseJsonBody(request);
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  if (typeof payload.is_done !== "boolean") {
    return jsonResponse(400, { error: "is_done_required" });
  }

  const isDone = payload.is_done ? 1 : 0;
  await env.DB.prepare(
    "INSERT INTO user_progress (user_id, subtopic_id, is_done, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(user_id, subtopic_id) DO UPDATE SET is_done = excluded.is_done, updated_at = datetime('now')",
  )
    .bind(auth.user.id, subtopicId, isDone)
    .run();

  return jsonResponse(200, { ok: true });
}
