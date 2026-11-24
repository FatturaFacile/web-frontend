import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommissionsApiService, PermissionsService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { parameter, translateSpy, wrap, zone } from './agent-commissions.testing';
import {
  AGENT_COMMISSIONS_MODULE,
  AGENT_COMMISSIONS_SETTLE_MODULE,
} from './agent-commissions.util';
import { SettingsComponent } from './settings.component';

const messageSpy = { success: vi.fn(), error: vi.fn() };
const bracketParameter = parameter('p-firr', {
  code: 'firr_brackets',
  mandate_type: 'single',
  value: null,
  payload: [
    { up_to: 12500, rate: 4 },
    { up_to: null, rate: 0 },
  ],
});

describe('SettingsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let access: Record<string, boolean>;

  beforeEach(() => {
    vi.clearAllMocks();
    access = { [AGENT_COMMISSIONS_MODULE]: true, [AGENT_COMMISSIONS_SETTLE_MODULE]: true };
    api = {
      listZones: vi.fn(() =>
        of(wrap([zone('1'), zone('2', { country: null, regions: [], is_active: false })])),
      ),
      listFiscalParameters: vi.fn(() =>
        of(
          wrap([
            parameter('p-1', { code: 'vat_rate', mandate_type: null, value: '22.0000' }),
            parameter('p-2', { is_override: true, value: '45000.00' }),
            bracketParameter,
          ]),
        ),
      ),
      createZone: vi.fn(() => of(wrap(zone('3')))),
      updateZone: vi.fn(() => of(wrap(zone('1')))),
      deleteZone: vi.fn(() => of(wrap(null))),
      saveFiscalOverride: vi.fn(() => of(wrap(parameter('p-9', { is_override: true })))),
      deleteFiscalOverride: vi.fn(() => of(wrap(null))),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AgentCommissionsApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: (module: string) => access[module] } },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy() },
        provideNzIcons(icons),
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const tables = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('nz-table')).map((table) =>
      Array.from(table.querySelectorAll('tbody tr')).filter((row) => row.querySelector('td')),
    );

  it('lists the zones with country and regions', async () => {
    const fixture = await render();
    const [zones] = tables(fixture.nativeElement as HTMLElement);

    expect(zones).toHaveLength(2);
    expect(zones[0].textContent).toContain('Z1');
    expect(zones[0].textContent).toContain('Zone 1');
    expect(zones[0].textContent).toContain('MI, TO');
    expect(zones[1].textContent).toContain('agentCommissions.action.no');
  });

  it('shows each fiscal parameter as statutory or company value', async () => {
    const fixture = await render();
    const [, parameters] = tables(fixture.nativeElement as HTMLElement);
    const text = parameters.map((row) => row.textContent).join('|');

    expect(parameters).toHaveLength(3);
    expect(text).toContain('agentCommissions.fiscal.vat_rate');
    expect(text).toContain('22%');
    expect(text).toContain('agentCommissions.fiscal.enasarco_massimale');
    expect(text).toContain('agentCommissions.enasarco.override');
    expect(text).toContain('agentCommissions.enasarco.statutory');
    expect(text).toContain('agentCommissions.fiscal.firr_brackets');
    expect(text).toContain('12500: 4%');
  });

  it('shows the removal of an override only on the rows that are overrides', async () => {
    const fixture = await render();
    const [, parameters] = tables(fixture.nativeElement as HTMLElement);
    const removable = parameters.filter((row) =>
      row.textContent?.includes('agentCommissions.action.removeOverride'),
    );

    expect(removable).toHaveLength(1);
    expect(removable[0].textContent).toContain('agentCommissions.enasarco.override');
  });

  it('lets a manager of the conditions edit the zones but not the fiscal parameters', async () => {
    access[AGENT_COMMISSIONS_SETTLE_MODULE] = false;

    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('agentCommissions.action.new');
    expect(text).toContain('agentCommissions.action.edit');
    expect(text).not.toContain('agentCommissions.action.saveOverride');
    expect(text).not.toContain('agentCommissions.action.removeOverride');
  });

  it('lets a read-only member see both tables and change nothing', async () => {
    access[AGENT_COMMISSIONS_MODULE] = false;
    access[AGENT_COMMISSIONS_SETTLE_MODULE] = false;

    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent as string;

    expect(tables(root).map((rows) => rows.length)).toEqual([2, 3]);
    expect(text).not.toContain('agentCommissions.action.new');
    expect(text).not.toContain('agentCommissions.action.edit');
    expect(text).not.toContain('agentCommissions.action.delete');
    expect(text).not.toContain('agentCommissions.action.saveOverride');
  });

  it('creates a zone from the dialog with the regions as a list', async () => {
    const component = (await render()).componentInstance;

    component.openZone(null);
    expect(component.zoneValid()).toBe(false);
    component.patchZone({ code: 'NORD', name: 'North', country: 'it', regions: 'mi, to ' });
    expect(component.zoneValid()).toBe(true);
    await component.saveZone();

    expect(api['createZone']).toHaveBeenCalledWith({
      code: 'NORD',
      name: 'North',
      country: 'IT',
      regions: ['MI', 'TO'],
      is_active: true,
    });
    expect(component.zoneOpen()).toBe(false);
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.saved');
  });

  it('edits an existing zone', async () => {
    const component = (await render()).componentInstance;

    component.openZone(component.store.zones()[0]);
    component.patchZone({ name: 'North west' });
    await component.saveZone();

    expect(api['updateZone']).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ name: 'North west' }),
    );
  });

  it('keeps the zone dialog open and shows the refusal of a duplicate code', async () => {
    api['createZone'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({ status: 422, error: { errors: { code: ['Already taken'] } } }),
      ),
    );
    const component = (await render()).componentInstance;
    component.openZone(null);
    component.patchZone({ code: 'NORD', name: 'North' });

    await component.saveZone();

    expect(component.zoneOpen()).toBe(true);
    expect(component.modalError()?.detail).toBe('Already taken');
    expect(messageSpy.success).not.toHaveBeenCalled();
  });

  it('deletes a zone, or shows the refusal', async () => {
    const component = (await render()).componentInstance;

    await component.removeZone(component.store.zones()[0]);
    expect(api['deleteZone']).toHaveBeenCalledWith('1');
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.deleted');

    api['deleteZone'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'generic' } })),
    );
    await component.removeZone(component.store.zones()[0]);
    expect(component.actionError()).toBe('agentCommissions.error.generic');
  });

  it('saves a numeric override for the code, mandate and year of the row', async () => {
    const component = (await render()).componentInstance;
    const row = component.store.parameters().find((entry) => entry.id === 'p-2');

    component.openParameter(row as never);
    expect(component.parameterValue()).toBe(45000);
    component.parameterValue.set(46000);
    expect(component.parameterValid()).toBe(true);
    await component.saveParameter();

    expect(api['saveFiscalOverride']).toHaveBeenCalledWith({
      code: 'enasarco_massimale',
      mandate_type: 'multi',
      year: 2026,
      value: 46000,
      payload: null,
    });
    expect(component.parameter()).toBeNull();
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.saved');
  });

  it('refuses a percentage above 100 before it reaches the API', async () => {
    const component = (await render()).componentInstance;

    component.openParameter(component.store.parameters()[0]);
    component.parameterValue.set(120);

    expect(component.parameterValid()).toBe(false);
    await component.saveParameter();
    expect(api['saveFiscalOverride']).not.toHaveBeenCalled();
  });

  it('edits the FIRR brackets as rows and sends them as the payload', async () => {
    const component = (await render()).componentInstance;

    component.openParameter(bracketParameter);
    expect(component.brackets()).toEqual([
      { from: null, to: 12500, rate: 4 },
      { from: null, to: null, rate: 0 },
    ]);

    component.patchBracket(0, { to: 15000, rate: 3 });
    component.removeBracket(1);
    component.addBracket();
    expect(component.parameterValid()).toBe(false);
    component.patchBracket(1, { rate: 0 });
    await component.saveParameter();

    expect(api['saveFiscalOverride']).toHaveBeenCalledWith({
      code: 'firr_brackets',
      mandate_type: 'single',
      year: 2026,
      value: null,
      payload: [
        { up_to: 15000, rate: 3 },
        { up_to: null, rate: 0 },
      ],
    });
  });

  it('refuses FIRR brackets whose ceilings do not increase', async () => {
    const component = (await render()).componentInstance;

    component.openParameter(bracketParameter);
    component.patchBracket(0, { to: 0 });

    expect(component.parameterValid()).toBe(false);
  });

  it('removes an override and goes back to the statutory value', async () => {
    const component = (await render()).componentInstance;
    const row = component.store.parameters().find((entry) => entry.id === 'p-2');

    await component.removeOverride(row as never);

    expect(api['deleteFiscalOverride']).toHaveBeenCalledWith('p-2');
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.deleted');
  });
});
