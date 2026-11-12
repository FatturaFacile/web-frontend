import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore, SalesCycleApiService } from '@core';
import { icons } from '../../../../icons-provider';
import { DocumentFormModalComponent } from './document-form-modal.component';
import { SalesLookupsService } from './sales-lookups.service';

describe('DocumentFormModalComponent validation', () => {
  let fixture: ComponentFixture<DocumentFormModalComponent>;
  let component: DocumentFormModalComponent;
  const api = {
    createQuote: vi.fn().mockReturnValue(of({ success: true, data: { id: 'q1' } })),
    updateQuote: vi.fn(),
    createOrder: vi.fn(),
    updateOrder: vi.fn(),
  };

  beforeEach(() => {
    api.createQuote.mockClear();
    TestBed.configureTestingModule({
      imports: [DocumentFormModalComponent],
      providers: [
        provideNzIcons(icons),
        { provide: SalesCycleApiService, useValue: api },
        { provide: AuthStore, useValue: { activeCurrency: () => 'EUR' } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: SalesLookupsService,
          useValue: {
            contacts: () => [],
            products: () => [],
            warehouses: () => [],
            load: vi.fn(),
            contactLabel: () => '',
          },
        },
      ],
    });
    fixture = TestBed.createComponent(DocumentFormModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('kind', 'quote');
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  });

  it('does not call the API when submitted empty', () => {
    (component as unknown as { submit(): void }).submit();

    expect(api.createQuote).not.toHaveBeenCalled();
    const form = (component as unknown as { form: { controls: { contact_id: { touched: boolean } } } }).form;
    expect(form.controls.contact_id.touched).toBe(true);
  });

  it('rejects a tax rate above 100 in a line', () => {
    const items = (component as unknown as { items: { at(i: number): { patchValue(v: object): void } } }).items;
    const form = (component as unknown as { form: { patchValue(v: object): void } }).form;
    form.patchValue({ contact_id: 'c1' });
    items.at(0).patchValue({ description: 'Service', tax_rate: '150' });

    (component as unknown as { submit(): void }).submit();

    expect(api.createQuote).not.toHaveBeenCalled();
  });
});
