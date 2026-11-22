import { describe, expect, it } from 'vitest';
import { computeCoverage, type CoverageInput } from './coverage';

const empty: CoverageInput = {
  title: 'Daire',
  description: null,
  listingType: 'SALE',
  propertyType: null,
  priceMinor: null,
  grossAreaM2: null,
  netAreaM2: null,
  roomLayout: null,
  city: null,
  district: null,
  neighborhood: null,
  buildingAge: null,
  floor: null,
  heatingType: null,
  furnished: null,
  photoCount: 0,
};

describe('computeCoverage', () => {
  it('gives only the always-present basics to an empty listing, with hints for the rest', () => {
    const c = computeCoverage(empty);
    expect(c.score).toBe(5);
    expect(c.level).toBe('low');
    expect(c.items.filter((i) => i.hint).length).toBe(c.items.length - 1);
  });

  it('reaches 100 for a complete listing with 10 photos', () => {
    const c = computeCoverage({
      ...empty,
      description: 'x'.repeat(120),
      propertyType: 'Daire',
      priceMinor: 1n,
      grossAreaM2: 120,
      roomLayout: '3+1',
      city: 'İstanbul',
      district: 'Kadıköy',
      neighborhood: 'Moda',
      buildingAge: 5,
      floor: '3',
      heatingType: 'Kombi',
      furnished: false,
      photoCount: 10,
    });
    expect(c.score).toBe(100);
    expect(c.level).toBe('high');
  });

  it('credits photos proportionally', () => {
    expect(computeCoverage({ ...empty, photoCount: 5 }).score).toBe(15);
  });
});
