/**
 * Constant-time string compare. Lengths may differ; the loop still runs
 * over the longer input so a mismatch is not returned on the first byte.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export function bearerToken(authorization: string | null): string {
  if (!authorization) return '';
  const match = /^Bearer\s+(\S+)/i.exec(authorization.trim());
  return match?.[1] ?? '';
}

/**
 * Scheduler HTTP entry. Fail closed when SCHEDULER_SECRET is unset.
 * A present secret is compared in constant time.
 */
export function schedulerRequestAuthorized(
  expected: string | undefined | null,
  provided: string | null,
): boolean {
  if (!expected) return false;
  return constantTimeEqual(provided ?? '', expected);
}

/**
 * Draw bypass. Both the service-role bearer and the scheduler secret must
 * match. Anything else, including the public anon key plus a correct secret,
 * is not a bypass and must use the normal admin check.
 */
export function schedulerBypassAuthorized(args: {
  authorizationHeader: string | null;
  schedulerSecretHeader: string | null;
  serviceRoleKey: string | undefined | null;
  schedulerSecret: string | undefined | null;
}): boolean {
  const key = args.serviceRoleKey ?? '';
  const secret = args.schedulerSecret ?? '';
  const bearerMatches = key.length > 0 && constantTimeEqual(bearerToken(args.authorizationHeader), key);
  const secretMatches = secret.length > 0 && constantTimeEqual(args.schedulerSecretHeader ?? '', secret);
  return bearerMatches && secretMatches;
}

/** Automatic draw may run only while it is still pending and opted in. */
export function schedulerMayDraw(event: {
  draw_status: string | null;
  auto_draw_enabled: boolean | null;
}): boolean {
  return event.draw_status === 'pending' && event.auto_draw_enabled === true;
}
