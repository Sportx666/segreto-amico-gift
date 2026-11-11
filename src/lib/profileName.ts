/** Display name used when a profile row is first created. */
export function displayNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const meta = user.user_metadata?.display_name;
  if (typeof meta === 'string' && meta.trim()) return meta.trim();
  const local = user.email?.split('@')[0]?.trim();
  return local || 'User';
}
