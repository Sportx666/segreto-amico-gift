import { describe, it, expect } from 'vitest';
import { normalizeExternalUrl, safeExternalHref } from '../url';

describe('normalizeExternalUrl', () => {
  it('keeps http(s) links', () => {
    expect(normalizeExternalUrl('https://www.amazon.it/dp/B08N5WRWNW')).toBe('https://www.amazon.it/dp/B08N5WRWNW');
    expect(normalizeExternalUrl('  http://example.com/a?b=1 ')).toBe('http://example.com/a?b=1');
  });

  it('adds https:// when the scheme is missing', () => {
    expect(normalizeExternalUrl('www.amazon.it/dp/B08N5WRWNW')).toBe('https://www.amazon.it/dp/B08N5WRWNW');
  });

  it('rejects script and other non-web schemes', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:x', 'file:///etc/passwd']) {
      expect(normalizeExternalUrl(bad)).toBeNull();
    }
  });

  it('rejects empty input', () => {
    expect(normalizeExternalUrl('')).toBeNull();
    expect(normalizeExternalUrl('   ')).toBeNull();
    expect(normalizeExternalUrl(null)).toBeNull();
  });
});

describe('safeExternalHref', () => {
  it('returns undefined for unsafe links so nothing is clickable', () => {
    expect(safeExternalHref('javascript:alert(document.cookie)')).toBeUndefined();
    expect(safeExternalHref(undefined)).toBeUndefined();
  });

  it('passes through web links', () => {
    expect(safeExternalHref('https://example.com/')).toBe('https://example.com/');
  });
});
