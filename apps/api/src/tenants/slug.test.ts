import { describe, expect, it } from 'vitest';
import { makeSlug } from './slug';

describe('makeSlug', () => {
  it('transliterates Turkish characters and adds a suffix', () => {
    expect(makeSlug('Çağlar Gayrimenkul Şişli Ofisi')).toMatch(
      /^caglar-gayrimenkul-sisli-ofisi-[0-9a-f]{6}$/,
    );
  });

  it('falls back when nothing usable remains', () => {
    expect(makeSlug('!!!')).toMatch(/^workspace-[0-9a-f]{6}$/);
  });
});
