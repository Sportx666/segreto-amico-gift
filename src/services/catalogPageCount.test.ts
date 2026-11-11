import { describe, expect, it } from 'vitest';
import {
  catalogHasNextPage,
  catalogPageCount,
  catalogVisiblePages,
  pageForSearchCriteria,
} from './catalog';

describe('catalogPageCount', () => {
  it('returns one page when there are no results', () => {
    expect(catalogPageCount(0, 10)).toBe(1);
  });

  it('rounds up partial pages', () => {
    expect(catalogPageCount(11, 10)).toBe(2);
    expect(catalogPageCount(10, 10)).toBe(1);
    expect(catalogPageCount(25, 10)).toBe(3);
  });

  it('caps Amazon and unknown providers at page 10 and leaves Rainforest uncapped', () => {
    expect(catalogVisiblePages('amazon', 500, 10)).toBe(10);
    expect(catalogVisiblePages(undefined, 500, 10)).toBe(10);
    expect(catalogVisiblePages('mock', 500, 10)).toBe(10);
    expect(catalogVisiblePages('rainforest', 500, 10)).toBe(50);
  });

  it('stops on a short page even when the reported total is larger', () => {
    expect(catalogHasNextPage(2, 10, 4, 10)).toBe(false);
    expect(catalogHasNextPage(2, 10, 10, 10)).toBe(true);
    expect(catalogHasNextPage(10, 10, 10, 10)).toBe(false);
  });

  it('uses page 1 in the same render as a new query', () => {
    expect(pageForSearchCriteria({ criteria: 'old', page: 2 }, 'new')).toBe(1);
    expect(pageForSearchCriteria({ criteria: 'old', page: 2 }, 'old')).toBe(2);
  });
});
