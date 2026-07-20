import { describe, expect, it } from 'vitest';
import { nextSearchIndex, searchDashboard } from './search.js';

describe('local dashboard search', () => {
  it('ranks local matches and always provides an explicit DuckDuckGo result', () => {
    const results = searchDashboard('argo');
    expect(results[0]?.label).toBe('Argo CD');
    expect(results.at(-1)?.href).toBe('https://duckduckgo.com/?q=argo');
  });

  it('supports arrow and vi-style result movement without leaving bounds', () => {
    expect(nextSearchIndex(0, 4, -1)).toBe(3);
    expect(nextSearchIndex(3, 4, 1)).toBe(0);
    expect(nextSearchIndex(0, 0, 1)).toBe(-1);
  });
});
