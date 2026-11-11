import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve('supabase/migrations/20261111120000_safe_profile_on_signup.sql'),
  'utf8',
);

describe('profile signup migration display names', () => {
  it('trims whitespace-only names in the trigger and the backfill', () => {
    expect(sql).toContain("NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), '')");
    expect(sql).toContain("NULLIF(btrim(split_part(COALESCE(NEW.email, ''), '@', 1)), '')");
    expect(sql).toContain("NULLIF(btrim(u.raw_user_meta_data->>'display_name'), '')");
    expect(sql).toContain("NULLIF(btrim(split_part(COALESCE(u.email, ''), '@', 1)), '')");
    expect(sql).not.toContain("NULLIF(NEW.raw_user_meta_data->>'display_name', '')");
    expect(sql).not.toContain("NULLIF(u.raw_user_meta_data->>'display_name', '')");
  });
});
