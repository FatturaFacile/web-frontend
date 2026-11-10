import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { I18nService, PortalApiService } from '@core';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { PayslipLinkComponent } from './payslip-link.component';

describe('PayslipLinkComponent', () => {
  let fixture: ComponentFixture<PayslipLinkComponent>;
  const api = { openPayslipLink: vi.fn() };

  interface Internals {
    form: { patchValue: (value: { birth_date: string }) => void };
    failed: () => boolean;
    opened: () => boolean;
    open: () => void;
  }
  const internals = () => fixture.componentInstance as unknown as Internals;

  beforeEach(async () => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:payslip');
    window.URL.revokeObjectURL = vi.fn();
    api.openPayslipLink.mockReturnValue(of(new Blob(['pdf'])));

    await TestBed.configureTestingModule({
      imports: [PayslipLinkComponent],
      providers: [
        { provide: PortalApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token: 'slip-token' }) } } },
        { provide: I18nService, useValue: { translate: (key: string) => key, currentLang: () => 'en', lang: () => 'en' } },
        provideNzIcons(icons),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PayslipLinkComponent);
    fixture.detectChanges();
  });

  it('does not call the API without a date of birth', () => {
    internals().open();
    expect(api.openPayslipLink).not.toHaveBeenCalled();
  });

  it('opens the link with the token of the route and the date of birth, then downloads the PDF', () => {
    internals().form.patchValue({ birth_date: '1985-04-12' });
    internals().open();

    expect(api.openPayslipLink).toHaveBeenCalledWith('slip-token', { birth_date: '1985-04-12' });
    expect(internals().opened()).toBe(true);
    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });

  it('shows a single generic error because the API answers 404 to every failure', () => {
    api.openPayslipLink.mockReturnValue(throwError(() => ({ status: 404 })));
    internals().form.patchValue({ birth_date: '1990-01-01' });
    internals().open();

    expect(internals().failed()).toBe(true);
    expect(internals().opened()).toBe(false);
  });
});
