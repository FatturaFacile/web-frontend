import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore, TranslateService, WorkflowApiService, WorkflowRemoteApprovalPreview } from '@core';
import { icons } from '../../icons-provider';
import { TEST_PASSWORD } from '../../../testing/credentials';
import { ApprovalTokenConfirmPageComponent } from './approval-token-confirm.page';

function preview(overrides: Partial<WorkflowRemoteApprovalPreview> = {}): WorkflowRemoteApprovalPreview {
  return {
    requires_reauth: false,
    subject_label: 'PO 2026-001',
    subject_type: 'purchase_order',
    amount: 1200,
    currency: 'CHF',
    requester_name: 'Mario Rossi',
    approver_name: 'Anna Bianchi',
    action: 'approve',
    expires_at: '2026-12-01T10:00:00Z',
    ...overrides,
  };
}

describe('ApprovalTokenConfirmPageComponent', () => {
  let fixture: ComponentFixture<ApprovalTokenConfirmPageComponent>;
  let component: ApprovalTokenConfirmPageComponent;

  const api = { getRemoteApprovalPreview: vi.fn(), confirmRemoteApproval: vi.fn() };
  const authenticated = signal(false);

  async function open(token: string | null, action: string | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ApprovalTokenConfirmPageComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        {
          provide: TranslateService,
          useValue: {
            currentLanguage: signal('en'),
            translate: (key: string) => key,
            instant: (key: string) => key,
          },
        },
        { provide: WorkflowApiService, useValue: api },
        { provide: AuthStore, useValue: { isAuthenticated: authenticated } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (name: string) => (name === 'token' ? token : null) },
              queryParamMap: { get: (name: string) => (name === 'action' ? action : null) },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApprovalTokenConfirmPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    authenticated.set(false);
    api.getRemoteApprovalPreview.mockReturnValue(of({ success: true, message: '', data: preview() }));
    api.confirmRemoteApproval.mockReturnValue(of({ message: 'ok', step_id: 's1', status: 'approved' }));
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('rejects a link without token or with an unknown action', async () => {
    await open('tok-1', 'maybe');

    expect(component.state()).toBe('invalid');
    expect(api.getRemoteApprovalPreview).not.toHaveBeenCalled();
  });

  it('loads the preview and decides nothing until the approver confirms', async () => {
    await open('tok-1', 'approve');

    expect(api.getRemoteApprovalPreview).toHaveBeenCalledWith('tok-1', 'approve');
    expect(component.state()).toBe('confirm');
    expect(api.confirmRemoteApproval).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('PO 2026-001');
  });

  it('confirms an approval and shows the result', async () => {
    await open('tok-1', 'approve');

    component.confirm();

    expect(api.confirmRemoteApproval).toHaveBeenCalledWith('tok-1', { action: 'approve', confirm: true });
    expect(component.state()).toBe('done');
  });

  it('requires a comment to reject', async () => {
    api.getRemoteApprovalPreview.mockReturnValue(of({ success: true, message: '', data: preview({ action: 'reject' }) }));
    await open('tok-1', 'reject');

    component.confirm();
    expect(component.formError()).toBe('workflows.token.error.commentRequired');
    expect(api.confirmRemoteApproval).not.toHaveBeenCalled();

    component.comment.set('Not needed');
    component.confirm();
    expect(api.confirmRemoteApproval).toHaveBeenCalledWith('tok-1', { action: 'reject', confirm: true, comment: 'Not needed' });
  });

  it('sends a signed-out approver to the login when the document needs a fresh proof of identity', async () => {
    api.getRemoteApprovalPreview.mockReturnValue(of({ success: true, message: '', data: preview({ requires_reauth: true }) }));
    await open('tok/1', 'approve');

    expect(component.state()).toBe('login_required');
    expect(component.returnUrl()).toBe('/approve/tok%2F1?action=approve');
  });

  it('asks a signed-in approver for the password or a code and sends it', async () => {
    authenticated.set(true);
    api.getRemoteApprovalPreview.mockReturnValue(of({ success: true, message: '', data: preview({ requires_reauth: true }) }));
    await open('tok-1', 'approve');
    expect(component.state()).toBe('confirm');

    component.confirm();
    expect(component.formError()).toBe('workflows.token.error.proofRequired');
    expect(api.confirmRemoteApproval).not.toHaveBeenCalled();

    component.password.set(TEST_PASSWORD);
    component.confirm();
    expect(api.confirmRemoteApproval).toHaveBeenCalledWith('tok-1', { action: 'approve', confirm: true, password: TEST_PASSWORD });
    expect(component.state()).toBe('done');
    expect(component.password()).toBe('');
  });

  it('keeps the form open when the re-authentication fails (403)', async () => {
    authenticated.set(true);
    api.getRemoteApprovalPreview.mockReturnValue(of({ success: true, message: '', data: preview({ requires_reauth: true }) }));
    api.confirmRemoteApproval.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    await open('tok-1', 'approve');

    component.otp.set('123456');
    component.confirm();

    expect(component.state()).toBe('confirm');
    expect(component.formError()).toBe('workflows.token.error.reauthFailed');
    expect(component.submitting()).toBe(false);
  });

  it.each([
    [410, 'expired'],
    [403, 'forbidden'],
    [404, 'invalid'],
    [500, 'error'],
  ])('shows the %s state of the preview', async (status, expected) => {
    api.getRemoteApprovalPreview.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
    await open('tok-1', 'approve');

    expect(component.state()).toBe(expected);
  });

  it('shows the expired state when the link was used in the meantime (410 on confirm)', async () => {
    api.confirmRemoteApproval.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 410 })));
    await open('tok-1', 'approve');

    component.confirm();

    expect(component.state()).toBe('expired');
  });
});
