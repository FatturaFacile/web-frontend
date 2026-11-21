import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ByokKeyManagementComponent } from './byok-key-management.component';
import { DataSovereigntyApiService } from './data-sovereignty-api.service';
import {
  all,
  audit,
  baseProviders,
  byId,
  dashboardFixture,
  envelope,
  inBody,
  ok,
  resource,
  settle,
} from './data-sovereignty.testing';
import { canConfirmKillSwitch } from './data-sovereignty.utils';

function type(element: HTMLElement | null, value: string): void {
  const input = element as HTMLInputElement | HTMLTextAreaElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ByokKeyManagementComponent', () => {
  let fixture: ComponentFixture<ByokKeyManagementComponent>;
  let api: {
    dashboard: ReturnType<typeof vi.fn>;
    auditLogs: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
    killSwitch: ReturnType<typeof vi.fn>;
    configureByok: ReturnType<typeof vi.fn>;
  };
  const message = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
  const phrase = 'SUSPEND KEY ACCESS';
  const reason = 'Suspected compromise of the application servers';

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(ByokKeyManagementComponent);
    await settle(fixture);
  }

  async function openKillSwitch(
    testId: 'open-suspend' | 'open-shred' = 'open-suspend',
  ): Promise<void> {
    (byId(fixture, testId) as HTMLButtonElement).click();
    await settle(fixture);
  }

  async function fillKillSwitch(values: {
    reason?: string;
    phrase?: string;
    mfa?: string;
  }): Promise<void> {
    type(inBody('kill-reason'), values.reason ?? reason);
    type(inBody('kill-phrase'), values.phrase ?? phrase);
    type(inBody('kill-mfa'), values.mfa ?? '123456');
    await settle(fixture);
  }

  const confirm = (): HTMLButtonElement => inBody('kill-confirm') as HTMLButtonElement;

  beforeEach(() => {
    api = {
      dashboard: vi.fn(() => ok(dashboardFixture())),
      auditLogs: vi.fn(() =>
        ok([audit('ROTATE_KEK')], { chain: { valid: true, checked: 1, broken_at: null } }),
      ),
      rotate: vi.fn(() => ok(resource())),
      killSwitch: vi.fn(() => ok(resource({ status: 'SUSPENDED' }))),
      configureByok: vi.fn(() => ok({ handshake: { wrap: true, unwrap: true }, envelope: null })),
    };
    message.error.mockClear();
    message.success.mockClear();
    message.warning.mockClear();
    TestBed.configureTestingModule({
      providers: baseProviders([
        provideRouter([]),
        { provide: DataSovereigntyApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
      ]) as never,
    });
  });

  afterEach(() => {
    fixture?.nativeElement.remove();
    document.body
      .querySelectorAll('.cdk-overlay-container')
      .forEach((overlay) => (overlay.innerHTML = ''));
  });

  it('shows the state of the key and its rotation', async () => {
    await create();

    const card = byId(fixture, 'envelope-card')?.textContent ?? '';
    expect(byId(fixture, 'envelope-status')?.textContent).toContain(
      'DATA_SOVEREIGNTY.STATUS_ACTIVE',
    );
    expect(card).toContain('v1');
    expect(card).toContain('BYOK');
    expect(card).toContain('DATA_SOVEREIGNTY.PROVIDER_SECUROSYS_PRIMUS_HSM');
    expect(byId(fixture, 'rotation-due')).toBeNull();
  });

  it('flags an overdue rotation', async () => {
    api.dashboard.mockReturnValue(
      ok(dashboardFixture({ key_envelopes: [envelope({ rotation_due: true })] })),
    );
    await create();

    expect(byId(fixture, 'rotation-due')).not.toBeNull();
  });

  it('rotates the key now and shows the new version', async () => {
    await create();

    (byId(fixture, 'rotate') as HTMLButtonElement).click();
    await settle(fixture);

    expect(api.rotate).toHaveBeenCalledWith('env-1');
    expect(message.success).toHaveBeenCalledWith('DATA_SOVEREIGNTY.ROTATED');
    expect(byId(fixture, 'envelope-card')?.textContent).toContain('v2');
  });

  it('reports a failed rotation with the reason from the server', async () => {
    api.rotate.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 502,
            error: { title: 'KMS Unavailable', detail: 'SECUROSYS_PRIMUS_HSM is unreachable.' },
          }),
      ),
    );
    await create();

    (byId(fixture, 'rotate') as HTMLButtonElement).click();
    await settle(fixture);

    expect(message.error).toHaveBeenCalledWith('SECUROSYS_PRIMUS_HSM is unreachable.');
  });

  describe('kill-switch confirmation guard', () => {
    it('keeps the confirm button disabled until the phrase, the code and the reason are right', async () => {
      await create();
      await openKillSwitch();

      expect(inBody('required-phrase')?.textContent).toBe(phrase);
      expect(confirm().disabled).toBe(true);

      await fillKillSwitch({ phrase: 'suspend key access' });
      expect(confirm().disabled).toBe(true);

      await fillKillSwitch({ mfa: '12345' });
      expect(confirm().disabled).toBe(true);

      await fillKillSwitch({ mfa: '12345a' });
      expect(confirm().disabled).toBe(true);

      await fillKillSwitch({ reason: 'too short' });
      expect(confirm().disabled).toBe(true);

      await fillKillSwitch({});
      expect(confirm().disabled).toBe(false);
    });

    it('never calls the API from a form submitted while the guard is not met', async () => {
      await create();
      await openKillSwitch();
      await fillKillSwitch({ phrase: 'WRONG' });

      (inBody('kill-form') as HTMLFormElement).dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await settle(fixture);

      expect(api.killSwitch).not.toHaveBeenCalled();
    });

    it('suspends the key with the step-up code and locks the page', async () => {
      await create();
      await openKillSwitch();
      await fillKillSwitch({});

      confirm().click();
      await settle(fixture);

      expect(api.killSwitch).toHaveBeenCalledWith('env-1', {
        action: 'SUSPEND',
        reason,
        confirmation_phrase: phrase,
        mfa_code: '123456',
      });
      expect(message.warning).toHaveBeenCalledWith('DATA_SOVEREIGNTY.KEY_LOCKED');
      expect(byId(fixture, 'envelope-status')?.textContent).toContain(
        'DATA_SOVEREIGNTY.STATUS_SUSPENDED',
      );
      expect((byId(fixture, 'rotate') as HTMLButtonElement).disabled).toBe(true);
      expect((byId(fixture, 'open-suspend') as HTMLButtonElement).disabled).toBe(true);
      // The dialog closes (its content leaves the overlay when the close animation ends).
      expect(fixture.componentInstance['killAction']()).toBeNull();
    });

    it('asks for a different phrase before a permanent crypto-shred', async () => {
      await create();
      await openKillSwitch('open-shred');

      expect(inBody('required-phrase')?.textContent).toBe('PERMANENTLY SHRED');
      await fillKillSwitch({});
      expect(confirm().disabled).toBe(true);

      await fillKillSwitch({ phrase: 'PERMANENTLY SHRED' });
      expect(confirm().disabled).toBe(false);

      api.killSwitch.mockReturnValue(ok(resource({ status: 'REVOKED_CRYPTO_SHREDDED' })));
      confirm().click();
      await settle(fixture);

      expect(api.killSwitch).toHaveBeenCalledWith(
        'env-1',
        expect.objectContaining({
          action: 'CRYPTO_SHRED',
          confirmation_phrase: 'PERMANENTLY SHRED',
        }),
      );
      expect((byId(fixture, 'open-shred') as HTMLButtonElement).disabled).toBe(true);
    });

    it('stays open and shows the reason when the step-up code is refused', async () => {
      api.killSwitch.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 403,
              error: {
                title: 'Step-up Authentication Failed',
                detail: 'A valid second-factor code is required for the kill-switch.',
              },
            }),
        ),
      );
      await create();
      await openKillSwitch();
      await fillKillSwitch({ mfa: '000000' });

      confirm().click();
      await settle(fixture);

      expect(inBody('kill-error')?.textContent).toContain('A valid second-factor code');
      expect(inBody('kill-form')).not.toBeNull();
      expect(byId(fixture, 'envelope-status')?.textContent).toContain(
        'DATA_SOVEREIGNTY.STATUS_ACTIVE',
      );
    });

    it('clears the form when the dialog is closed and reopened', async () => {
      await create();
      await openKillSwitch();
      await fillKillSwitch({});
      (inBody('kill-cancel') as HTMLButtonElement).click();
      await settle(fixture);
      expect(fixture.componentInstance['killAction']()).toBeNull();

      await openKillSwitch();
      expect((inBody('kill-phrase') as HTMLInputElement).value).toBe('');
      expect(confirm().disabled).toBe(true);
    });

    it('applies the same rule in the pure guard', () => {
      expect(canConfirmKillSwitch('SUSPEND', phrase, '123456', reason)).toBe(true);
      expect(canConfirmKillSwitch('SUSPEND', ` ${phrase} `, '123456', reason)).toBe(true);
      expect(canConfirmKillSwitch('SUSPEND', 'PERMANENTLY SHRED', '123456', reason)).toBe(false);
      expect(canConfirmKillSwitch('CRYPTO_SHRED', phrase, '123456', reason)).toBe(false);
      expect(canConfirmKillSwitch('SUSPEND', phrase, '12 456', reason)).toBe(false);
    });
  });

  describe('HSM wizard', () => {
    async function openWizard(): Promise<void> {
      (byId(fixture, 'open-wizard') as HTMLButtonElement).click();
      await settle(fixture);
    }

    it('tests the handshake without saving and reports the result', async () => {
      await create();
      await openWizard();
      type(inBody('key-uri'), 'https://hsm.example.ch/v1/keys/ff');
      await settle(fixture);

      (inBody('test-handshake') as HTMLButtonElement).click();
      await settle(fixture);

      expect(api.configureByok).toHaveBeenCalledWith(
        expect.objectContaining({
          dry_run: true,
          provider_type: 'SECUROSYS_PRIMUS_HSM',
          key_management_mode: 'BYOK',
          external_key_uri: 'https://hsm.example.ch/v1/keys/ff',
          dek_cache_ttl_seconds: 300,
        }),
      );
      expect(inBody('handshake-result')?.textContent).toContain('DATA_SOVEREIGNTY.HANDSHAKE_OK');
    });

    it('reports a failed handshake with the reason of the server', async () => {
      api.configureByok.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: {
                detail:
                  'The AWS_KMS key is located in IT: a Strict-CH-Only policy requires a KMS/HSM located in CH.',
              },
            }),
        ),
      );
      await create();
      await openWizard();
      type(inBody('key-uri'), 'arn:aws:kms:eu-south-1:1:key/a');
      await settle(fixture);

      (inBody('test-handshake') as HTMLButtonElement).click();
      await settle(fixture);

      expect(inBody('handshake-result')?.textContent).toContain(
        'DATA_SOVEREIGNTY.HANDSHAKE_FAILED',
      );
      expect(inBody('wizard-error')?.textContent).toContain('located in IT');
    });

    it('does not allow saving without a key URI', async () => {
      await create();
      await openWizard();

      expect((inBody('save-wizard') as HTMLButtonElement).disabled).toBe(true);
      expect((inBody('test-handshake') as HTMLButtonElement).disabled).toBe(true);
    });

    it('forces the cache duration to zero for HYOK and sends it to the API', async () => {
      await create();
      await openWizard();
      expect(inBody('ttl')).not.toBeNull();

      const hyok = inBody('mode')?.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1];
      hyok?.click();
      await settle(fixture);
      type(inBody('key-uri'), 'https://hsm.example.ch/v1/keys/ff');
      await settle(fixture);

      expect(inBody('ttl')).toBeNull();
      (inBody('save-wizard') as HTMLButtonElement).click();
      await settle(fixture);

      expect(api.configureByok).toHaveBeenCalledWith(
        expect.objectContaining({
          dry_run: false,
          key_management_mode: 'HYOK',
          dek_cache_ttl_seconds: 0,
        }),
      );
    });

    it('masks the secret credentials', async () => {
      await create();
      await openWizard();

      const types = Object.fromEntries(
        Array.from(document.body.querySelectorAll<HTMLInputElement>('[id^="cred-"]')).map(
          (input) => [input.id, input.type],
        ),
      );
      expect(types).toEqual({ 'cred-bearer_token': 'password', 'cred-country_iso2': 'text' });
    });
  });

  describe('KMS access stream', () => {
    it('lists the entries and the state of the hash chain', async () => {
      await create();

      expect(all(fixture, '[data-testid="audit-row"]').length).toBe(2);
      expect(byId(fixture, 'chain-status')?.textContent).toContain('DATA_SOVEREIGNTY.CHAIN_VALID');
    });

    it('shows a broken chain as an error', async () => {
      api.dashboard.mockReturnValue(
        ok(
          dashboardFixture({
            kms_audit: {
              chain: { valid: false, checked: 1, broken_at: 'x' },
              recent: [audit('UNWRAP_DEK')],
            },
          }),
        ),
      );
      await create();

      expect(byId(fixture, 'chain-status')?.textContent).toContain('DATA_SOVEREIGNTY.CHAIN_BROKEN');
    });

    it('reloads the stream filtered by operation', async () => {
      await create();

      fixture.componentInstance['filterAudit']('KILL_SWITCH_SUSPEND');
      await settle(fixture);

      expect(api.auditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'KILL_SWITCH_SUSPEND' }),
      );
      expect(all(fixture, '[data-testid="audit-row"]').length).toBe(1);
    });
  });

  it('invites to configure a key when there is none', async () => {
    api.dashboard.mockReturnValue(ok(dashboardFixture({ key_envelopes: [] })));
    await create();

    expect(byId(fixture, 'no-envelope')).not.toBeNull();
    expect(byId(fixture, 'kill-switch-card')).toBeNull();
  });
});
