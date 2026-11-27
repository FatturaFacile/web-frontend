import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GcCrew, GcLicense, I18nService, PermissionsService } from '@core';
import { icons } from '../../icons-provider';
import { GreenCareCrewsComponent } from './green-care-crews.component';
import { GreenCareCrewStore } from './green-care.stores';

const license = (overrides: Partial<GcLicense> = {}): GcLicense => ({
  id: 'l-1',
  crew_team_member_id: 'm-1',
  operator_name: 'Marco',
  license_type: 'PAN',
  jurisdiction: 'IT',
  license_number: 'PAN-1',
  issuing_authority: 'Regione',
  issue_date: '2024-01-01',
  expiry_date: '2030-01-01',
  is_active: true,
  is_valid: true,
  days_to_expiry: 900,
  ...overrides,
});

const crew: GcCrew = {
  id: 'c-1',
  name: 'Squadra Nord',
  code: 'N1',
  default_vehicle_plate: 'AB123CD',
  default_trailer_plate: null,
  equipment: { lawnmowers: 2 },
  daily_capacity_minutes: 480,
  depot_latitude: 45.1,
  depot_longitude: 9.1,
  is_active: true,
  members: [{ id: 'm-1', name: 'Marco', user_id: null, role: 'leader', hourly_rate: 28, licenses: [license()] }],
};

interface Internals {
  badgeState: (value: GcLicense) => string;
  payload: () => { members: { id?: string; name: string }[]; equipment: Record<string, number> };
  openForm: (value: GcCrew | null) => void;
  licensesOf: (memberId: string) => GcLicense[];
  licenseValid: () => boolean;
}

describe('GreenCareCrewsComponent', () => {
  const load = vi.fn();

  beforeEach(() => {
    load.mockClear();
    TestBed.configureTestingModule({
      imports: [GreenCareCrewsComponent],
      providers: [
        provideNzIcons(icons),
        { provide: GreenCareCrewStore, useValue: { crews: signal([crew]), load } },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: I18nService, useValue: { translate: (key: string) => key, instant: (key: string) => key } },
      ],
    });
  });

  it('lists the crews and loads them on init', () => {
    const fixture = TestBed.createComponent(GreenCareCrewsComponent);
    fixture.detectChanges();

    expect(load).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-test="crew-c-1"]')?.textContent).toContain('Squadra Nord');
  });

  it('builds the payload with the equipment counts and the members, keeping the id of saved members', () => {
    const fixture = TestBed.createComponent(GreenCareCrewsComponent);
    const component = fixture.componentInstance as unknown as Internals;
    component.openForm(crew);

    const payload = component.payload();

    expect(payload.equipment).toEqual({ lawnmowers: 2 });
    expect(payload.members).toEqual([{ id: 'm-1', name: 'Marco', role: 'leader', hourly_rate: 28 }]);
    expect(component.licensesOf('m-1')).toHaveLength(1);
  });

  it('badges a licence as valid, expiring within 30 days or expired', () => {
    const component = TestBed.createComponent(GreenCareCrewsComponent).componentInstance as unknown as Internals;

    expect(component.badgeState(license())).toBe('valid');
    expect(component.badgeState(license({ days_to_expiry: 12 }))).toBe('expiring');
    expect(component.badgeState(license({ days_to_expiry: -3, is_valid: false }))).toBe('expired');
  });
});
