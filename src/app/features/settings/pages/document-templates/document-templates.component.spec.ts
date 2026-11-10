import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../../icons-provider';
import { I18nService, PermissionsService, SettingsApiService } from '@core';
import { DocumentTemplatesComponent } from './document-templates.component';

interface Harness {
  rows(): { type: string; template: unknown }[];
  edit(row: { type: string; template: unknown }): void;
  primaryColor: { set(value: string): void };
  footerText: { set(value: string): void };
  save(): void;
  reset(row: { type: string; template: unknown }): void;
}

describe('DocumentTemplatesComponent', () => {
  let fixture: ComponentFixture<DocumentTemplatesComponent>;
  let harness: Harness;

  const api = {
    getDocumentTemplates: vi.fn(),
    getDocumentQuota: vi.fn(),
    saveDocumentTemplate: vi.fn(),
    deleteDocumentTemplate: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };
  const modal = { confirm: vi.fn((options: { nzOnOk: () => void }) => options.nzOnOk()) };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getDocumentTemplates.mockReturnValue(
      of({ data: [{ id: 't1', document_type: 'invoice', primary_color: '#112233', secondary_color: null, footer_text: 'Thanks', logo_data_uri: null }] }),
    );
    api.getDocumentQuota.mockReturnValue(of({ data: { enabled: true, limit: '100', used: '40', remaining: '60', year: 2026 } }));
    api.saveDocumentTemplate.mockReturnValue(of({ data: {} }));
    api.deleteDocumentTemplate.mockReturnValue(of({ data: null }));

    await TestBed.overrideProvider(NzModalService, { useValue: modal })
      .configureTestingModule({
      imports: [DocumentTemplatesComponent],
      providers: [
        provideNzIcons(icons),
        { provide: SettingsApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: NzMessageService, useValue: message },
        { provide: NzModalService, useValue: modal },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentTemplatesComponent);
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
  });

  it('lists every document type, marking the ones with an override, and shows the quota', () => {
    expect(harness.rows().length).toBe(9);
    expect(harness.rows().find((row) => row.type === 'invoice')?.template).not.toBeNull();
    expect(harness.rows().find((row) => row.type === 'quote')?.template).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('40');
  });

  it('saves the branding of a type', () => {
    const invoice = harness.rows().find((row) => row.type === 'invoice')!;
    harness.edit(invoice);
    harness.primaryColor.set('#445566');
    harness.save();

    expect(api.saveDocumentTemplate).toHaveBeenCalledWith('invoice', {
      primary_color: '#445566',
      secondary_color: null,
      footer_text: 'Thanks',
    });
  });

  it('refuses a colour that is not #RRGGBB', () => {
    harness.edit(harness.rows()[0]);
    harness.primaryColor.set('red');
    harness.save();
    expect(api.saveDocumentTemplate).not.toHaveBeenCalled();
  });

  it('resets an override after confirmation', () => {
    harness.reset(harness.rows().find((row) => row.type === 'invoice')!);
    expect(api.deleteDocumentTemplate).toHaveBeenCalledWith('invoice');
  });
});
