import { afterEach, describe, expect, it } from 'vitest';
import { currentPageName } from './export-xlsx';

describe('currentPageName', () => {
  afterEach(() => {
    document.title = '';
  });

  it('returns the translated page title without the application name', () => {
    document.title = 'Anagrafica clienti · Fattura Facile';
    expect(currentPageName()).toBe('Anagrafica clienti');
  });

  it('replaces the characters that are not allowed in a file name', () => {
    document.title = 'Ordini / Consegne: 2026 · Fattura Facile';
    expect(currentPageName()).toBe('Ordini - Consegne- 2026');
  });

  it('returns null when the page has no title', () => {
    document.title = 'Fattura Facile';
    expect(currentPageName()).toBeNull();
  });
});
