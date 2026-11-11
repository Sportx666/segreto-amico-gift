import { describe, expect, it } from 'vitest';
import { displayNameFromUser } from './profileName';

describe('displayNameFromUser', () => {
  it('prefers the name stored on the auth user', () => {
    expect(displayNameFromUser({
      email: 'ada@example.com',
      user_metadata: { display_name: 'Ada' },
    })).toBe('Ada');
  });

  it('falls back to the mailbox name', () => {
    expect(displayNameFromUser({ email: 'ada@example.com' })).toBe('ada');
  });

  it('uses a placeholder when nothing else is available', () => {
    expect(displayNameFromUser({})).toBe('User');
  });
});
