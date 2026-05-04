import type { JsonValue } from "../types";

export const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

export const CORS_HEADERS = {
  // With credentials/cookies, ACAO cannot be "*"; it must be an explicit origin.
  "access-control-allow-origin": "https://ds-frontend-e9s.pages.dev",
  "access-control-allow-credentials": "true",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "access-control-allow-headers":
    "content-type, authorization, x-dev-user-email",
};

export function jsonResponse(
  status: number,
  body: JsonValue,
  extraHeaders: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...CORS_HEADERS, ...extraHeaders },
  });
}

export function textResponse(
  status: number,
  body: string,
  extraHeaders: HeadersInit = {},
) {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, ...extraHeaders },
  });
}

export function handleOptions() {
  return textResponse(204, "", {
    "access-control-allow-origin": "https://ds-frontend-e9s.pages.dev",
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "access-control-allow-headers":
      "content-type, authorization, x-dev-user-email",
  });
}

export function parseJsonBody<T>(request: Request) {
  return request.json() as Promise<T>;
}

export function getPathParts(pathname: string) {
  return pathname.split("/").filter(Boolean);
}
