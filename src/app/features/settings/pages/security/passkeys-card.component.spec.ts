import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IamApiService, PasskeyItem, WebAuthnService } from '@core';
import { icons } from '../../../../icons-provider';
import { PasskeysCardComponent } from './passkeys-card.component';

const passkeys: PasskeyItem[] = [
  { id: 'p1', name: 'Laptop', aaguid: null, created_at: '2026-11-01T10:00:00Z', last_used_at: null },
  { id: 'p2', name: 'Phone', aaguid: null, created_at: '2026-11-02T10:00:00Z', last_used_at: '2026-11-20T10:00:00Z' },
];

describe('PasskeysCardComponent', () => {
  const api = {
    passkeys: vi.fn(),
    beginPasskeyRegistration: vi.fn(),
    finishPasskeyRegistration: vi.fn(),
    renamePasskey: vi.fn(),
    revokePasskey: vi.fn(),
  };
  const webauthn = { isSupported: vi.fn(), create: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };
  const confirm = vi.fn();

  async function create() {
    TestBed.overrideComponent(PasskeysCardComponent, { set: { providers: [{ provide: NzModalService, useValue: { confirm } }] } });
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: IamApiService, useValue: api },
        { provide: WebAuthnService, useValue: webauthn },
        { provide: NzMessageService, useValue: message },
        { provide: NzModalService, useValue: { confirm } },
      ],
    });
    const fixture = TestBed.createComponent(PasskeysCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    webauthn.isSupported.mockReturnValue(true);
    api.passkeys.mockReturnValue(of({ success: true, message: '', data: passkeys }));
  });

  it('lists the passkeys with rename and remove actions', async () => {
    const { el } = await create();

    expect(el.textContent).toContain('Laptop');
    expect(el.querySelectorAll('[data-testid="rename-passkey"]').length).toBe(2);
    expect(el.querySelectorAll('[data-testid="revoke-passkey"]').length).toBe(2);
  });

  it('renames a passkey and updates the list', async () => {
    api.renamePasskey.mockReturnValue(of({ success: true, message: '', data: { ...passkeys[0], name: 'Work laptop' } }));
    const { component } = await create();

    component['openRename'](passkeys[0]);
    expect(component['renameValue']()).toBe('Laptop');
    component['renameValue'].set(' Work laptop ');
    await component['rename']();

    expect(api.renamePasskey).toHaveBeenCalledWith('p1', 'Work laptop');
    expect(component['passkeys']().map((item) => item.name)).toEqual(['Work laptop', 'Phone']);
    expect(component['renameTarget']()).toBeNull();
    expect(message.success).toHaveBeenCalled();
  });

  it('does not rename to a blank name', async () => {
    const { component } = await create();

    component['openRename'](passkeys[0]);
    component['renameValue'].set('   ');
    await component['rename']();

    expect(api.renamePasskey).not.toHaveBeenCalled();
  });

  it('keeps the old name when the rename fails', async () => {
    api.renamePasskey.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422 })));
    const { component } = await create();

    component['openRename'](passkeys[0]);
    component['renameValue'].set('Other');
    await component['rename']();

    expect(component['passkeys']()[0].name).toBe('Laptop');
    expect(message.success).not.toHaveBeenCalled();
  });

  it('shows the recovery codes once after the first passkey is registered', async () => {
    api.beginPasskeyRegistration.mockReturnValue(of({ data: { ceremony_id: 'c1', options: {} } }));
    webauthn.create.mockResolvedValue({ id: 'cred' });
    api.finishPasskeyRegistration.mockReturnValue(
      of({ success: true, message: '', data: { ...passkeys[0], recovery_codes: ['AAAA-1111', 'BBBB-2222'] } }),
    );
    const { component } = await create();
    component['name'].set('Laptop');

    await component['register']();

    expect(api.finishPasskeyRegistration).toHaveBeenCalledWith('c1', 'Laptop', { id: 'cred' });
    expect(component['recoveryCodes']()).toEqual(['AAAA-1111', 'BBBB-2222']);
  });

  it('shows no recovery codes when the API sends none', async () => {
    api.beginPasskeyRegistration.mockReturnValue(of({ data: { ceremony_id: 'c1', options: {} } }));
    webauthn.create.mockResolvedValue({ id: 'cred' });
    api.finishPasskeyRegistration.mockReturnValue(of({ success: true, message: '', data: { ...passkeys[0], recovery_codes: null } }));
    const { component } = await create();
    component['name'].set('Laptop');

    await component['register']();

    expect(component['recoveryCodes']()).toEqual([]);
  });

  it('explains that the last required factor cannot be removed', async () => {
    api.revokePasskey.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'mfa_cannot_be_disabled' } })),
    );
    const { component } = await create();

    component['confirmRevoke'](passkeys[0]);
    await (confirm.mock.calls[0][0] as { nzOnOk: () => Promise<void> }).nzOnOk();

    expect(component['lastFactor']()).toBe(true);
    expect(component['passkeys']().length).toBe(2);
  });

  it('removes a passkey and reloads the list', async () => {
    api.revokePasskey.mockReturnValue(of({ success: true, message: '', data: null }));
    const { component } = await create();
    component['lastFactor'].set(true);

    component['confirmRevoke'](passkeys[1]);
    await (confirm.mock.calls[0][0] as { nzOnOk: () => Promise<void> }).nzOnOk();

    expect(api.revokePasskey).toHaveBeenCalledWith('p2');
    expect(component['lastFactor']()).toBe(false);
    expect(api.passkeys).toHaveBeenCalledTimes(2);
  });
});
