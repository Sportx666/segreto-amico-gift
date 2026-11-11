import { describe, expect, it } from 'vitest';
import { readFunctionError } from './functionError';

describe('readFunctionError', () => {
  it('reads the error field from a function Response', async () => {
    const context = new Response(JSON.stringify({ error: 'expired' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
    await expect(readFunctionError({ message: 'Edge Function returned a non-2xx status code', context })).resolves.toBe('expired');
  });

  it('returns a sentence body used by the draw function', async () => {
    const context = new Response(JSON.stringify({ error: 'Impossibile rispettare i vincoli' }), { status: 400 });
    await expect(readFunctionError({ context })).resolves.toBe('Impossibile rispettare i vincoli');
  });

  it('returns null when there is no response body', async () => {
    await expect(readFunctionError(new Error('network'))).resolves.toBeNull();
    await expect(readFunctionError(null)).resolves.toBeNull();
  });
});
