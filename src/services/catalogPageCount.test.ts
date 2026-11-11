import { describe, expect, it } from 'vitest';
import { catalogPageCount } from './catalog';

describe('catalogPageCount', () => {
  it('returns one page when there are no results', () => {
    expect(catalogPageCount(0, 10)).toBe(1);
  });

  it('rounds up partial pages', () => {
    expect(catalogPageCount(11, 10)).toBe(2);
    expect(catalogPageCount(10, 10)).toBe(1);
    expect(catalogPageCount(25, 10)).toBe(3);
  });
});
