import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { QR_BILL_REPOSITORY } from '@domain/repositories/qr-bill.repository';
import { QrBillStore } from '../../state/qr-bill.store';
import { SwissQrBillComponent } from './swiss-qr-bill.component';

describe('SwissQrBillComponent', () => {
  it('loads the bills through the repository of its store and renders without error', async () => {
    const getBills = vi.fn().mockReturnValue(of([]));
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SwissQrBillComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: QR_BILL_REPOSITORY, useValue: { getBills } },
        QrBillStore,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SwissQrBillComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement).toBeInstanceOf(HTMLElement);
    expect(getBills).toHaveBeenCalled();
  });
});
