import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ShiftAssignment,
  ShiftPlanningApiService,
  ShiftSwapRequest,
  TranslateService,
} from '@core';
import { icons } from '../../icons-provider';
import { MyShiftsComponent } from './my-shifts.component';

const shift = (patch: Partial<ShiftAssignment> = {}): ShiftAssignment => ({
  id: 'a-1',
  roster_schedule_period_id: 'p-1',
  employee_id: 'e-1',
  is_open: false,
  shift_date: '2026-03-02',
  shift_template_id: 't-1',
  template: { code: 'MOR', name: { en: 'Morning' }, color_hex: '#1890ff', is_on_call: false },
  start_at: '2026-03-02T06:00:00Z',
  end_at: '2026-03-02T14:00:00Z',
  required_role_or_skill_id: null,
  surcharge_breakdown: null,
  compliance_warnings: [],
  has_blocking_issue: false,
  ...patch,
});

const incoming: ShiftSwapRequest = {
  id: 's-1',
  requester_employee_id: 'e-9',
  target_peer_employee_id: 'e-1',
  is_broadcast: false,
  shift_assignment_id: 'a-9',
  target_shift_assignment_id: null,
  status: 'pending_peer_acceptance',
  peer_responded_at: null,
  reviewed_by_user_id: null,
  reviewed_at: null,
  rejection_reason: null,
  created_at: null,
};

const wrap = <T>(data: T) => ({ success: true, message: 'ok', data });
const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};
const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

describe('MyShiftsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      getMyShifts: vi.fn(() => of(wrap([shift()]))),
      getOpenShifts: vi.fn(() =>
        of(wrap([shift({ id: 'o-1', employee_id: null, is_open: true })])),
      ),
      getMySwaps: vi.fn(() => of(wrap([incoming]))),
      getTeamShifts: vi.fn(() => of(wrap([]))),
      getEligiblePeers: vi.fn(() => of(wrap([]))),
      claimOpenShift: vi.fn(() => of(wrap({ assignment: shift(), warnings: [] }))),
      respondToSwap: vi.fn(() => of(wrap(incoming))),
      requestSwap: vi.fn(() => of(wrap(incoming))),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ShiftPlanningApiService, useValue: api },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    });
  });

  function render(): MyShiftsComponent {
    const fixture = TestBed.createComponent(MyShiftsComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('loads the agenda, the open shifts and the swaps of a four weeks window', () => {
    const component = render();

    expect(api['getMyShifts']).toHaveBeenCalledWith(component.from(), component.to());
    expect(api['getOpenShifts']).toHaveBeenCalledOnce();
    expect(api['getMySwaps']).toHaveBeenCalledOnce();
    expect(component.shifts()).toHaveLength(1);
    expect(component.agenda()[0]?.[1][0]?.label).toBe('Morning');
  });

  it('knows who is reading from the own shifts', () => {
    expect(render().employeeId()).toBe('e-1');
  });

  it('adds the colleagues to the agenda only when the team view is on', () => {
    api['getTeamShifts'] = vi.fn(() =>
      of(
        wrap([
          {
            id: 'x-1',
            employee_id: 'e-2',
            employee_name: 'Bruno Bianchi',
            shift_date: '2026-03-02',
            template: { code: 'NOT', name: { en: 'Night' }, color_hex: '#722ed1' },
            start_at: '2026-03-02T21:00:00Z',
            end_at: '2026-03-03T05:00:00Z',
          },
        ]),
      ),
    );
    const component = render();
    expect(component.agenda().flatMap(([, items]) => items)).toHaveLength(1);

    component.toggleTeam(true);

    const items = component.agenda().flatMap(([, list]) => list);
    expect(items).toHaveLength(2);
    expect(items.some((item) => item.who === 'Bruno Bianchi')).toBe(true);
  });

  it('claims an open shift and reloads', () => {
    const component = render();

    component.claim(component.openShifts()[0] as ShiftAssignment);

    expect(api['claimOpenShift']).toHaveBeenCalledWith('o-1');
    expect(messageSpy.success).toHaveBeenCalledWith('SHIFT_PLANNING.CLAIMED');
    expect(api['getMyShifts']).toHaveBeenCalledTimes(2);
  });

  it('shows the blocking rule of a refused claim', () => {
    api['claimOpenShift'] = vi.fn(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              detail: 'Refused',
              invalid_params: [
                {
                  severity: 'blocking_error',
                  rule_code: 'REST.MIN_DAILY',
                  translation_key: 'SHIFT_PLANNING.RULE_REST_MIN_DAILY',
                  params: { hours: 11 },
                },
              ],
            },
          }),
      ),
    );
    const component = render();

    component.claim(component.openShifts()[0] as ShiftAssignment);

    expect(translateSpy.instant).toHaveBeenCalledWith('SHIFT_PLANNING.RULE_REST_MIN_DAILY', {
      hours: 11,
    });
    expect(messageSpy.error).toHaveBeenCalled();
    expect(component.claiming()).toBeNull();
  });

  it('lets the employee accept an incoming swap', () => {
    const component = render();

    expect(component.respondable(incoming)).toBe(true);
    component.respond(incoming, 'approve');

    expect(api['respondToSwap']).toHaveBeenCalledWith('s-1', 'approve');
    expect(messageSpy.success).toHaveBeenCalledWith('SHIFT_PLANNING.SWAP_ANSWERED');
  });

  it('asks the eligible colleagues of the chosen shift and sends a broadcast swap', () => {
    const component = render();
    component.openSwapModal();

    component.pickShift('a-1');
    expect(api['getEligiblePeers']).toHaveBeenCalledWith('a-1');

    component.pickPeer(component.broadcast);
    component.sendSwap();

    expect(api['requestSwap']).toHaveBeenCalledWith({
      shift_assignment_id: 'a-1',
      target_peer_employee_id: null,
      target_shift_assignment_id: null,
    });
    expect(component.swapOpen()).toBe(false);
  });

  it('offers the shifts of the picked colleague as an exchange', () => {
    api['getEligiblePeers'] = vi.fn(() =>
      of(
        wrap([
          {
            employee_id: 'e-2',
            name: 'Bruno Bianchi',
            warnings: [],
            shifts: [
              {
                id: 'c-1',
                shift_date: '2026-03-04',
                template_code: 'NOT',
                start_at: '2026-03-04T21:00:00Z',
                end_at: '2026-03-05T05:00:00Z',
              },
            ],
          },
        ]),
      ),
    );
    const component = render();
    component.openSwapModal();
    component.pickShift('a-1');

    component.pickPeer('e-2');
    expect(component.counterOptions()).toHaveLength(1);
    component.counterShiftId = 'c-1';
    component.sendSwap();

    expect(api['requestSwap']).toHaveBeenCalledWith({
      shift_assignment_id: 'a-1',
      target_peer_employee_id: 'e-2',
      target_shift_assignment_id: 'c-1',
    });
  });
});
