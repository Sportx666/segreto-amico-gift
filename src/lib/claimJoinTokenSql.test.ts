import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve('supabase/migrations/20261111140000_claim_join_token.sql'),
  'utf8',
);

describe('claim_join_token migration', () => {
  it('is executable only by service_role', () => {
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.claim_join_token(text, uuid) TO service_role');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.claim_join_token(text, uuid) FROM PUBLIC');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.claim_join_token(text, uuid) FROM anon');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.claim_join_token(text, uuid) FROM authenticated');
    expect(sql).not.toContain('GRANT EXECUTE ON FUNCTION public.claim_join_token(text, uuid) TO anon');
    expect(sql).not.toContain('GRANT EXECUTE ON FUNCTION public.claim_join_token(text, uuid) TO authenticated');
  });

  it('repoints participant foreign keys and keeps wishlist copies on conflict', () => {
    const tables = [
      'event_members',
      'wishlists',
      'wishlist_items',
      'assignments',
      'exclusions',
      'chat_messages',
      'private_chats',
      'anonymous_aliases',
      'notifications',
      'join_tokens',
      'private_chat_names',
    ];
    for (const table of tables) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain('ON CONFLICT (wishlist_id, asin) DO NOTHING');
    expect(sql).toContain('WHERE giver_id = blocked_id AND giver_id = canonical_id');
    expect(sql).toContain(
      'WHERE anonymous_participant_id = exposed_participant_id AND anonymous_participant_id = canonical_id',
    );
    expect(sql).toContain(
      'WHERE participant_a_id = participant_b_id AND participant_a_id = $1',
    );
    expect(sql).not.toContain('DELETE FROM public.exclusions WHERE giver_id = blocked_id;');
    expect(sql).not.toContain(
      'DELETE FROM public.private_chats WHERE anonymous_participant_id = exposed_participant_id;',
    );
    expect(sql).not.toContain(
      'DELETE FROM public.private_chat_names WHERE participant_a_id = participant_b_id;',
    );
    expect(sql).toContain('purchased_by');
    expect(sql).toContain('recipient_participant_id');
  });

  it('consumes the token only after the writes and aborts when nothing changes', () => {
    const consumeAt = sql.indexOf('SET used_at = now()');
    const memberAt = sql.indexOf('INSERT INTO public.event_members');
    expect(consumeAt).toBeGreaterThan(memberAt);
    expect(sql).toContain('used_at IS NULL');
    expect(sql).toContain("RAISE EXCEPTION 'token_already_consumed'");
  });

  it('re-selects the participant after a unique violation', () => {
    expect(sql).toContain('EXCEPTION WHEN unique_violation THEN');
    expect(sql.match(/EXCEPTION WHEN unique_violation THEN/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('documents rollback', () => {
    expect(sql).toContain('DROP FUNCTION IF EXISTS public.claim_join_token(text, uuid)');
  });
});
