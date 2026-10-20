/** For Next route handlers: forward explicit Firebase ID tokens, never cookies. */
export function readBearer(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9._~-]{20,8192})$/.exec(header);
  return match ? `Bearer ${match[1]}` : null;
}
