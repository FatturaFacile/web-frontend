import { describe, expect, it } from 'vitest';
import { describeError, scrubPii, scrubUrl } from './pii-scrubber';

describe('scrubPii', () => {
  it.each([
    ['mario.rossi@example.com', 'email'],
    ['IT60X0542811101000000123456', 'iban'],
    ['CH93 0076 2011 6238 5295 7', 'iban'],
    ['756.1234.5678.97', 'avs'],
    ['CHE-123.456.788 MWST', 'uid'],
    ['RSSMRA85T10A562S', 'cf'],
    ['IT01234567890', 'vat'],
    ['12345678901234', 'number'],
  ])('masks %s as %s', (value, kind) => {
    const result = scrubPii(`customer ${value} failed`);

    expect(result).toContain(`[redacted:${kind}]`);
    expect(result).not.toContain(value);
  });

  it('masks a bearer-like JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9abcdefghij.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlLXZhbHVl';

    expect(scrubPii(`Bearer ${jwt}`)).not.toContain('eyJ');
  });

  it('keeps harmless text and truncates long text', () => {
    expect(scrubPii('Navigation failed')).toBe('Navigation failed');
    expect(scrubPii('x'.repeat(500), 50)).toHaveLength(51);
    expect(scrubPii(null)).toBe('');
  });
});

describe('scrubUrl', () => {
  it('drops query string, fragment and credentials and replaces ids', () => {
    expect(
      scrubUrl('https://user:pw@api.example.com/api/v1/clients/0b0a2c52-6f4e-4a39-8b1f-0d5d7a6c0a11/invoices/42?search=mario#x'),
    ).toBe('https://api.example.com/api/v1/clients/:id/invoices/:id');
  });

  it('handles relative URLs and masks personal data in segments', () => {
    expect(scrubUrl('/api/v1/lookup/mario.rossi@example.com?x=1')).toBe('/api/v1/lookup/[redacted:email]');
    expect(scrubUrl(undefined)).toBe('');
  });
});

describe('describeError', () => {
  it('keeps the type and a scrubbed message, never the stack', () => {
    const error = new TypeError('cannot read IT60X0542811101000000123456');
    const described = describeError(error);

    expect(described.type).toBe('TypeError');
    expect(described.message).toContain('[redacted:iban]');
    expect(JSON.stringify(described)).not.toContain('at ');
  });

  it('reduces an HTTP error to its status and drops the body', () => {
    expect(describeError({ status: 500, error: { email: 'a@b.ch' } })).toEqual({ type: 'HttpError', message: 'HTTP 500' });
  });

  it('copes with strings and unknown values', () => {
    expect(describeError('boom a@b.ch').message).toBe('boom [redacted:email]');
    expect(describeError(42)).toEqual({ type: 'number', message: '' });
  });
});
