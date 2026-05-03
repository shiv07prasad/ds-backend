export type JsonValue =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

export type Env = {
  DB: D1Database;
};
