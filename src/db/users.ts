import type { Env } from "../types";

type UserRow = {
  id: number;
  email: string;
  name: string | null;
  user_name: string | null;
  is_admin: number;
};

export async function getUserByEmail(env: Env, email: string) {
  return (await env.DB.prepare(
    "SELECT id, email, name, user_name, is_admin FROM users WHERE email = ?",
  )
    .bind(email)
    .first()) as UserRow | null;
}

export async function ensureUser(env: Env, email: string) {
  const existing = await getUserByEmail(env, email);
  if (existing) {
    return existing;
  }

  return (await env.DB.prepare(
    "INSERT INTO users (email) VALUES (?) RETURNING id, email, name, user_name, is_admin",
  )
    .bind(email)
    .first()) as UserRow;
}

export async function findUserNameConflict(
  env: Env,
  userName: string,
  email: string,
) {
  const conflict = await env.DB.prepare(
    "SELECT id FROM users WHERE user_name = ? AND email <> ?",
  )
    .bind(userName, email)
    .first();

  return !!conflict;
}

export async function updateUserByEmail(
  env: Env,
  email: string,
  name: string | null,
  userName: string | null,
) {
  await env.DB.prepare(
    "UPDATE users SET name = COALESCE(?, name), user_name = COALESCE(?, user_name) WHERE email = ?",
  )
    .bind(name, userName, email)
    .run();

  return getUserByEmail(env, email);
}
