import { describe, expect, it } from 'vitest';
import { isEuMemberState, parseEuVat } from './vies.model';

describe('vies model', () => {
  it('rejects a malformed EU VAT number without a request', () => {
    expect(parseEuVat('DE123')).toBeNull();
    expect(parseEuVat('123456789', 'CH')).toBeNull();
  });

  it('normalises prefix, separators and the Greek EL code', () => {
    expect(parseEuVat('DE 123 456 789')).toEqual(['DE', '123456789']);
    expect(parseEuVat('123456789', 'DE')).toEqual(['DE', '123456789']);
    expect(parseEuVat('GR123456789')).toEqual(['EL', '123456789']);
    expect(parseEuVat('123456789', 'GR')).toEqual(['EL', '123456789']);
  });

  it('knows the EU member states', () => {
    expect(isEuMemberState('fr')).toBe(true);
    expect(isEuMemberState('GR')).toBe(true);
    expect(isEuMemberState('CH')).toBe(false);
    expect(isEuMemberState(null)).toBe(false);
  });
});
