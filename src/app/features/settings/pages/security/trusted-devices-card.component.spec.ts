import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiService, TrustedDevice } from '@core';
import { icons } from '../../../../icons-provider';
import { TrustedDevicesCardComponent } from './trusted-devices-card.component';

const devices: TrustedDevice[] = [
  { id: 'd1', label: 'Chrome / Windows', ip_address: '203.0.113.7', last_used_at: '2026-11-20T10:00:00Z', created_at: '2026-11-01T10:00:00Z', expires_at: '2026-12-01T10:00:00Z' },
  { id: 'd2', label: 'Safari / iOS', ip_address: null, last_used_at: null, created_at: '2026-11-10T10:00:00Z', expires_at: '2026-12-10T10:00:00Z' },
];

describe('TrustedDevicesCardComponent', () => {
  const api = { getTrustedDevices: vi.fn(), revokeTrustedDevice: vi.fn(), revokeAllTrustedDevices: vi.fn() };
  const confirm = vi.fn();
  const message = { success: vi.fn(), error: vi.fn() };

  function create() {
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: AuthApiService, useValue: api },
        { provide: NzModalService, useValue: { confirm } },
        { provide: NzMessageService, useValue: message },
      ],
    });
    const fixture = TestBed.createComponent(TrustedDevicesCardComponent);
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, changed, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getTrustedDevices.mockReturnValue(of({ success: true, message: '', data: devices, meta: { days: 30, enabled: true } }));
  });

  it('lists the trusted devices', () => {
    const { el } = create();

    expect(el.querySelectorAll('[data-testid="trusted-device-row"]').length).toBe(2);
    expect(el.textContent).toContain('Chrome / Windows');
    expect(el.querySelector('[data-testid="revoke-all-devices"]')).not.toBeNull();
  });

  it('shows the empty state without the remove all button', () => {
    api.getTrustedDevices.mockReturnValue(of({ success: true, message: '', data: [], meta: { days: 30, enabled: true } }));
    const { el } = create();

    expect(el.querySelector('[data-testid="trusted-empty"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="revoke-all-devices"]')).toBeNull();
  });

  it('explains that remembering devices is turned off by the administrator', () => {
    api.getTrustedDevices.mockReturnValue(of({ success: true, message: '', data: [], meta: { days: 30, enabled: false } }));
    const { el } = create();

    expect(el.querySelector('[data-testid="trusted-disabled"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="trusted-device-row"]')).toBeNull();
  });

  it('reports a list that cannot be loaded', () => {
    api.getTrustedDevices.mockReturnValue(throwError(() => new Error('boom')));
    const { component, el } = create();

    expect(component['loadFailed']()).toBe(true);
    expect(el.querySelector('[data-testid="trusted-device-row"]')).toBeNull();
  });

  it('removes one device after the confirmation', async () => {
    api.revokeTrustedDevice.mockReturnValue(of({ success: true, message: '', data: null }));
    const { component, changed } = create();

    component['confirmRevoke'](devices[0]);
    expect(api.revokeTrustedDevice).not.toHaveBeenCalled();
    await (confirm.mock.calls[0][0] as { nzOnOk: () => Promise<void> }).nzOnOk();

    expect(api.revokeTrustedDevice).toHaveBeenCalledWith('d1');
    expect(component['devices']().map((device) => device.id)).toEqual(['d2']);
    expect(message.success).toHaveBeenCalled();
    expect(changed).toHaveBeenCalledWith(1);
  });

  it('removes every device after the confirmation', async () => {
    api.revokeAllTrustedDevices.mockReturnValue(of({ success: true, message: '', data: { revoked: 2 } }));
    const { component, changed } = create();

    component['confirmRevokeAll']();
    await (confirm.mock.calls[0][0] as { nzOnOk: () => Promise<void> }).nzOnOk();

    expect(api.revokeAllTrustedDevices).toHaveBeenCalledTimes(1);
    expect(component['devices']()).toEqual([]);
    expect(changed).toHaveBeenCalledWith(0);
  });
});
