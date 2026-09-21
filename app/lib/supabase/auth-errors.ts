export type AuthErrorLike = { code?: string } | null | undefined;

const INVALID_SESSION_CODES = new Set([
  "bad_jwt",
  "session_not_found",
  "session_expired",
  "user_not_found",
]);

export function isInvalidSessionError(error: AuthErrorLike) {
  return typeof error?.code === "string" && INVALID_SESSION_CODES.has(error.code);
}
