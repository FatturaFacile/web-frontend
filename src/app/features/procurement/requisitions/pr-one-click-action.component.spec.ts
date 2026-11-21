import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService } from '@core/i18n';
import { PurchaseRequisitionApiService } from '@data-access/procurement/purchase-requisition-api.service';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { PrOneClickActionComponent } from './pr-one-click-action.component';

describe('PrOneClickActionComponent', () => {
  let fixture: ComponentFixture<PrOneClickActionComponent>;
  let component: PrOneClickActionComponent;
  let apiMock: {
    oneClickAction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    apiMock = {
      oneClickAction: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [PrOneClickActionComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        { provide: PurchaseRequisitionApiService, useValue: apiMock },
        {
          provide: I18nService,
          useValue: {
            currentLanguage: signal<'en'>('en'),
            translate: vi.fn((key: string) => key),
            setLanguage: vi.fn().mockResolvedValue({}),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(PrOneClickActionComponent);
    component = fixture.componentInstance;
  });

  it('executes approve immediately on init when token and action=approve are present', () => {
    apiMock.oneClickAction.mockReturnValueOnce(
      of({
        data: {
          requisition_id: 'pr-1',
          requisition_number: 'PR-2026-0077',
          status: 'approved',
          action: 'approve',
          acted_at: '2026-11-21T12:00:00Z',
        },
      }),
    );

    fixture.componentRef.setInput('tokenInput', 'valid-token-123');
    fixture.componentRef.setInput('actionInput', 'approve');
    fixture.detectChanges();

    expect(apiMock.oneClickAction).toHaveBeenCalledWith({
      token: 'valid-token-123',
      action: 'approve',
      comment: null,
    });
    expect(component.viewState()).toBe('success');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="one-click-success"]')).not.toBeNull();
    expect(el.textContent ?? '').toContain('PR-2026-0077');
  });

  it('renders comment confirmation form for action=reject and submits optional comment', () => {
    apiMock.oneClickAction.mockReturnValueOnce(
      of({
        data: {
          requisition_id: 'pr-1',
          requisition_number: 'PR-2026-0077',
          status: 'rejected',
          action: 'reject',
        },
      }),
    );

    fixture.componentRef.setInput('tokenInput', 'reject-token-456');
    fixture.componentRef.setInput('actionInput', 'reject');
    fixture.detectChanges();

    expect(apiMock.oneClickAction).not.toHaveBeenCalled();
    expect(component.viewState()).toBe('confirm_reject');

    component.commentControl.setValue('Defer purchase until Q1');
    component.submitRejection();
    fixture.detectChanges();

    expect(apiMock.oneClickAction).toHaveBeenCalledWith({
      token: 'reject-token-456',
      action: 'reject',
      comment: 'Defer purchase until Q1',
    });
    expect(component.viewState()).toBe('success');
  });

  it('renders error feedback when token is missing or API returns expired error', () => {
    fixture.componentRef.setInput('tokenInput', '');
    fixture.componentRef.setInput('actionInput', 'approve');
    fixture.detectChanges();

    expect(apiMock.oneClickAction).not.toHaveBeenCalled();
    expect(component.viewState()).toBe('error');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="one-click-error"]'),
    ).not.toBeNull();

    // Now simulate expired token error from backend
    const freshFixture = TestBed.createComponent(PrOneClickActionComponent);
    apiMock.oneClickAction.mockReturnValueOnce(
      throwError(() => ({ error: { detail: 'Token expired' } })),
    );
    freshFixture.componentRef.setInput('tokenInput', 'expired-token');
    freshFixture.componentRef.setInput('actionInput', 'approve');
    freshFixture.detectChanges();

    expect(freshFixture.componentInstance.viewState()).toBe('error');
    expect(freshFixture.componentInstance.errorMessage()).toBe('Token expired');
  });

  it('keeps rejection comment form visible when backend returns HTTP 422 validation error', () => {
    const rejectFixture = TestBed.createComponent(PrOneClickActionComponent);
    apiMock.oneClickAction.mockReturnValueOnce(
      throwError(() => ({
        status: 422,
        error: { message: 'A rejection comment of at least 3 characters is required.' },
      })),
    );

    rejectFixture.componentRef.setInput('tokenInput', 'reject-token-789');
    rejectFixture.componentRef.setInput('actionInput', 'reject');
    rejectFixture.detectChanges();

    rejectFixture.componentInstance.submitRejection();
    rejectFixture.detectChanges();

    expect(rejectFixture.componentInstance.viewState()).toBe('confirm_reject');
    expect(rejectFixture.componentInstance.rejectError()).toBe(
      'A rejection comment of at least 3 characters is required.',
    );
    expect(
      (rejectFixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="one-click-reject-validation-error"]',
      ),
    ).not.toBeNull();
  });
});
