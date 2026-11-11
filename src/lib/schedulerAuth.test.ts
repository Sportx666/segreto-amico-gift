import { describe, expect, it } from 'vitest';
import {
  constantTimeEqual,
  schedulerBypassAuthorized,
  schedulerMayDraw,
  schedulerRequestAuthorized,
} from '../../supabase/functions/_shared/schedulerAuth';

const serviceRole = 'service-role-key';
const secret = 'scheduler-secret';

describe('scheduler auth', () => {
  it('compares equal strings and rejects different ones', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });

  it('rejects the scheduler entry when the secret is missing', () => {
    expect(schedulerRequestAuthorized(undefined, secret)).toBe(false);
    expect(schedulerRequestAuthorized('', secret)).toBe(false);
    expect(schedulerRequestAuthorized(secret, null)).toBe(false);
  });

  it('rejects an anon key even when the scheduler secret is correct', () => {
    expect(schedulerBypassAuthorized({
      authorizationHeader: 'Bearer anon-key',
      schedulerSecretHeader: secret,
      serviceRoleKey: serviceRole,
      schedulerSecret: secret,
    })).toBe(false);
  });

  it('rejects the service role when the scheduler secret is wrong or missing', () => {
    expect(schedulerBypassAuthorized({
      authorizationHeader: `Bearer ${serviceRole}`,
      schedulerSecretHeader: 'wrong',
      serviceRoleKey: serviceRole,
      schedulerSecret: secret,
    })).toBe(false);
    expect(schedulerBypassAuthorized({
      authorizationHeader: `Bearer ${serviceRole}`,
      schedulerSecretHeader: null,
      serviceRoleKey: serviceRole,
      schedulerSecret: secret,
    })).toBe(false);
  });

  it('accepts the service role together with the matching secret', () => {
    expect(schedulerBypassAuthorized({
      authorizationHeader: `Bearer ${serviceRole}`,
      schedulerSecretHeader: secret,
      serviceRoleKey: serviceRole,
      schedulerSecret: secret,
    })).toBe(true);
  });

  it('refuses a completed or opted-out draw on the bypass path', () => {
    expect(schedulerMayDraw({ draw_status: 'completed', auto_draw_enabled: true })).toBe(false);
    expect(schedulerMayDraw({ draw_status: 'pending', auto_draw_enabled: false })).toBe(false);
    expect(schedulerMayDraw({ draw_status: 'pending', auto_draw_enabled: null })).toBe(false);
    expect(schedulerMayDraw({ draw_status: 'pending', auto_draw_enabled: true })).toBe(true);
  });
});
