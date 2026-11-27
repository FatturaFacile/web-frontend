import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { InboxOutline } from '@ant-design/icons-angular/icons';
import { BankingApiService } from '@core/api/banking-api.service';
import { camtResult, painResult } from './iso-reconciliation.testing';
import { TrIsoUploadComponent } from './tr-iso-upload.component';

async function mount(uploadIso20022: ReturnType<typeof vi.fn>) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideRouter([]),
      provideNzIcons([InboxOutline]),
      { provide: BankingApiService, useValue: { uploadIso20022 } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(TrIsoUploadComponent);
  fixture.detectChanges();

  return fixture;
}

const xml = (name: string) => new File(['<Document/>'], name, { type: 'text/xml' });

describe('TrIsoUploadComponent', () => {
  it('shows the detected type, statement and reconciliation summary of a camt.053', async () => {
    const upload = vi.fn().mockReturnValue(of({ success: true, data: camtResult }));
    const fixture = await mount(upload);
    const file = xml('camt053.xml');

    fixture.componentInstance.enqueue(file);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(upload).toHaveBeenCalledWith(file, { autoReconcile: true, paymentBatchId: null });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="type-tag"]')?.textContent).toContain('camt.053');
    expect(host.querySelector('[data-testid="upload-row"]')?.textContent).toContain('CH4431999123000889012');
    expect(host.querySelector('[data-testid="reconciliation-summary"]')?.textContent).toMatch(/3.*1.*2/s);
    expect(host.querySelector('[data-testid="totals"]')).not.toBeNull();
  });

  it('shows the pain.002 batch, its counters and the per line ISO reason code', async () => {
    const upload = vi.fn().mockReturnValue(of({ success: true, data: painResult }));
    const fixture = await mount(upload);

    fixture.componentInstance.enqueue(xml('pain002.xml'));
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="type-tag"]')?.textContent).toContain('pain.002');
    expect(host.querySelector('[data-testid="payment-summary"]')).not.toBeNull();
    expect(host.querySelectorAll('[data-testid="line-status-row"]')).toHaveLength(2);
    const reason = host.querySelectorAll('[data-testid="reason"]')[1]?.textContent ?? '';
    expect(reason).toContain('AC04');
    expect(host.querySelectorAll('[data-testid="outcome"]')[1]?.textContent).toMatch(/rejected/i);
  });

  it('sends the files one after the other and keeps a row per file', async () => {
    const order: string[] = [];
    const upload = vi.fn((file: File) => {
      order.push(`start:${file.name}`);

      return of({ success: true, data: { ...camtResult, filename: file.name } });
    });
    const fixture = await mount(upload);

    fixture.componentInstance.enqueue(xml('a.xml'));
    fixture.componentInstance.enqueue(xml('b.xml'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(order).toEqual(['start:a.xml', 'start:b.xml']);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="upload-row"]')).toHaveLength(2);
  });

  it('shows the API message of a refused file and continues with the next one', async () => {
    const upload = vi
      .fn()
      .mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'Unknown message type.' } })),
      )
      .mockReturnValueOnce(of({ success: true, data: camtResult }));
    const fixture = await mount(upload);

    fixture.componentInstance.enqueue(xml('bad.xml'));
    fixture.componentInstance.enqueue(xml('good.xml'));
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(upload).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[data-testid="upload-error"]')?.textContent).toContain('Unknown message type.');
    expect(host.querySelectorAll('[data-testid="type-tag"]')).toHaveLength(1);
  });

  it('refuses a file that is not XML without calling the API', async () => {
    const upload = vi.fn();
    const fixture = await mount(upload);

    fixture.componentInstance.enqueue(new File(['x'], 'statement.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();

    expect(upload).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="upload-error"]')).not.toBeNull();
  });
});
