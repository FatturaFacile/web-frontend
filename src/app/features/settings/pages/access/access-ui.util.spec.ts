import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it, vi } from 'vitest';
import { accessErrorMessage, humanize, reportAccessError, roleSelection, selectionPayload } from './access-ui.util';

const i18n = { translate: (key: string) => key } as never;

describe('access UI helpers', () => {
  it('shows title and detail of a 409 plan limit problem', () => {
    const err = new HttpErrorResponse({
      status: 409,
      error: { title: 'Plan limit reached', detail: 'The subscription plan allows at most 5 users.' },
    });

    expect(accessErrorMessage(err, i18n)).toBe('Plan limit reached: The subscription plan allows at most 5 users.');
  });

  it('falls back to a generic conflict text and ignores other statuses', () => {
    expect(accessErrorMessage(new HttpErrorResponse({ status: 409 }), i18n)).toBe('access.errors.conflict');
    expect(accessErrorMessage(new HttpErrorResponse({ status: 500 }), i18n)).toBeNull();
  });

  it('reports a 409 as a toast with the reason', () => {
    const message = { error: vi.fn() };

    reportAccessError(new HttpErrorResponse({ status: 409, error: { detail: 'Role in use' } }), message as never, i18n);

    expect(message.error).toHaveBeenCalledWith('Role in use');
  });

  it('encodes a role select value: system role key or custom role id', () => {
    expect(roleSelection('admin')).toBe('admin');
    expect(roleSelection('accountant', 'r1')).toBe('custom:r1');
    expect(selectionPayload('admin')).toEqual({ role: 'admin' });
    expect(selectionPayload('custom:r1')).toEqual({ custom_role_id: 'r1' });
  });

  it('humanizes a code', () => {
    expect(humanize('fiscal_retail')).toBe('Fiscal retail');
  });
});
