import { TestBed } from '@angular/core/testing';
import { I18nService, SdiTransmissionsApiService } from '@core';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../icons-provider';
import { SupplierFatturaPaImporterComponent } from './supplier-fatturapa-importer.component';

describe('SupplierFatturaPaImporterComponent', () => {
  const api = { importPassive: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };

  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: SdiTransmissionsApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
    const fixture = TestBed.createComponent(SupplierFatturaPaImporterComponent);
    fixture.detectChanges();

    return fixture;
  }

  const p7m = new File(['signed'], 'IT01234567897_AAAAA.xml.p7m');

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('previews the dropped file without saving anything', () => {
    api.importPassive.mockReturnValue(of({ success: true, message: '', data: { preview_html: '<p>F-1</p>', signature_verified: true } }));
    const fixture = setup();

    fixture.componentInstance.select(p7m);
    fixture.detectChanges();

    expect(api.importPassive).toHaveBeenCalledWith(p7m, true);
    expect(fixture.nativeElement.querySelector('[data-testid="import-file-name"]').textContent).toContain('.xml.p7m');
    expect(fixture.nativeElement.querySelector('[data-testid="sdi-preview-frame"]')).not.toBeNull();
  });

  it('creates the drafts on confirm and tells the page to refresh', () => {
    api.importPassive
      .mockReturnValueOnce(of({ success: true, message: '', data: { preview_html: '<p>F-1</p>', signature_verified: null } }))
      .mockReturnValueOnce(of({ success: true, message: '', data: { preview_html: '<p>F-1</p>', signature_verified: null, invoices: [{ duplicate: false, invoice: {} }] } }));
    const fixture = setup();
    const imported = vi.fn();
    fixture.componentInstance.imported.subscribe(imported);

    fixture.componentInstance.select(p7m);
    fixture.componentInstance.confirm();

    expect(api.importPassive).toHaveBeenLastCalledWith(p7m, false);
    expect(message.success).toHaveBeenCalledWith('sdiTransmissions.import.done');
    expect(imported).toHaveBeenCalled();
  });

  it('reports a file that is not a FatturaPA and keeps nothing selected', () => {
    api.importPassive.mockReturnValue(throwError(() => ({ status: 422, error: { title: 'Invalid' } })));
    const fixture = setup();

    fixture.componentInstance.select(new File(['x'], 'broken.xml'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="import-file-name"]')).toBeNull();
  });
});
