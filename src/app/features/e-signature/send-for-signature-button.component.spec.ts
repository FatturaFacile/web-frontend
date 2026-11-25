import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionsService, SignatureRequestService, TranslateService } from '@core';
import { SendForSignatureButtonComponent } from './send-for-signature-button.component';

describe('SendForSignatureButtonComponent', () => {
  let canWrite: boolean;
  let requests: { open: ReturnType<typeof vi.fn> };

  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(SendForSignatureButtonComponent);
    fixture.componentRef.setInput('signableType', 'purchase_order');
    fixture.componentRef.setInput('signableId', 'po-1');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    canWrite = true;
    requests = { open: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: PermissionsService, useValue: { canWrite: () => canWrite } },
        { provide: SignatureRequestService, useValue: requests },
        {
          provide: TranslateService,
          useValue: { instant: (key: string) => key, get: (key: string) => key },
        },
      ],
    });
  });

  it('asks the shell to open the wizard for the document, with its label and amount', () => {
    const fixture = render({ label: 'PO-77', amount: '30000.00', currency: 'CHF' });

    (
      fixture.nativeElement.querySelector('[data-test="send-for-signature"]') as HTMLButtonElement
    ).click();

    expect(requests.open).toHaveBeenCalledWith({
      signableType: 'purchase_order',
      signableId: 'po-1',
      label: 'PO-77',
      amount: '30000.00',
      currency: 'CHF',
    });
  });

  it('is not offered to a user who cannot start a signature', () => {
    canWrite = false;
    const fixture = render();

    expect(fixture.nativeElement.querySelector('[data-test="send-for-signature"]')).toBeNull();
  });

  it('does nothing before the document is saved', () => {
    const fixture = render({ signableId: null });

    (
      fixture.nativeElement.querySelector('[data-test="send-for-signature"]') as HTMLButtonElement
    ).click();

    expect(requests.open).not.toHaveBeenCalled();
  });
});
