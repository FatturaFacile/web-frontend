import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { PgErasurePreview } from '@core';
import { ErasurePreviewComponent } from './erasure-preview.component';

const preview: PgErasurePreview = {
  dry_run: true,
  status: 'partially_refused_fiscal_retention',
  fiscal_lock: { is_locked: true, retention_ends_at: '2035-12-31', records: [] },
  to_anonymize: [
    { table: 'crm_contacts', label: 'CRM contacts', module: 'CRM', rows: 3 },
    { table: 'helpdesk_tickets', label: 'Support tickets', module: 'Helpdesk', rows: 2 },
  ],
  protected: [{ table: 'invoices', module: 'Invoicing', rows: 4, retention_ends_at: '2035-12-31' }],
  refusal_legal_justification:
    'Art. 958f CO / Art. 2220 c.c.: invoices must be kept for ten years.',
};

function render(value: PgErasurePreview): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(ErasurePreviewComponent);
  fixture.componentRef.setInput('preview', value);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('erasure dry-run preview', () => {
  it('lists what is anonymised and what the fiscal lock protects, with the legal justification', () => {
    const element = render(preview);

    const anonymize = element.querySelector('[data-testid="to-anonymize-list"]')?.textContent ?? '';
    expect(anonymize).toContain('CRM contacts');
    expect(anonymize).toContain('Support tickets');

    const protectedRows =
      element.querySelector('[data-testid="protected-list"]')?.textContent ?? '';
    expect(protectedRows).toContain('invoices');
    expect(protectedRows).toContain('4');

    expect(element.querySelector('[data-testid="refusal"]')?.textContent).toContain('958f');
  });

  it('shows no refusal when nothing is protected', () => {
    const element = render({
      ...preview,
      fiscal_lock: { is_locked: false, retention_ends_at: null, records: [] },
      protected: [],
      refusal_legal_justification: null,
    });

    expect(element.querySelector('[data-testid="refusal"]')).toBeNull();
    expect(element.querySelectorAll('[data-testid="protected-list"] li')).toHaveLength(1);
  });
});
