import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import type { FsmBoard, FsmBoardLane, FsmBoardUnassigned } from '@core';
import { FsmApiService, I18nService, PermissionsService } from '@core';
import { icons } from '../../../icons-provider';
import { DispatcherBoardComponent, startOfWeek, toLocalInput } from './dispatcher-board.component';

interface Harness {
  filters: () => { vanReadiness: string; kind: string };
  filteredQueue: () => FsmBoardUnassigned[];
  selectedId: { set(value: string | null): void };
  form: { patchValue(value: object): void; getRawValue(): { technician_id: string; start: string; end: string } };
  dialogTarget: () => { workOrderId: string; item: FsmBoardUnassigned | null } | null;
  blockerGroups: () => { key: string; messages: string[] }[];
  liveHasWarnings: () => boolean;
  setFilter(key: string, value: string | null): void;
  openAssign(item: FsmBoardUnassigned, lane?: FsmBoardLane, at?: string): void;
  submit(): void;
  shiftWeek(weeks: number): void;
  weekStart: () => Date;
}

function unassigned(id: string, overrides: Partial<FsmBoardUnassigned> = {}): FsmBoardUnassigned {
  return {
    work_order_id: id,
    work_order_number: `WO-${id}`,
    title: `Job ${id}`,
    work_type: 'corrective',
    work_order_type: 'corrective',
    priority: 'normal',
    status: 'unscheduled',
    scheduled_start: null,
    scheduled_end: null,
    site: { address: 'Zurich', latitude: 47.37, longitude: 8.54 },
    required_skills: [],
    required_parts: [],
    service_contract_id: null,
    ...overrides,
  };
}

const lane: FsmBoardLane = {
  technician_id: 't1',
  name: 'Anna Rossi',
  is_available: true,
  skills: ['hvac'],
  van: { warehouse_id: 'v1', ready: true, distinct_products_in_stock: 1, stock: { p1: 2 } },
  blocks: [],
};

const board: FsmBoard = {
  window: { from: '2026-03-02T00:00:00Z', to: '2026-03-09T00:00:00Z' },
  unassigned: [
    unassigned('1', { priority: 'urgent', work_order_type: 'preventive', required_skills: ['hvac'] }),
    unassigned('2', { required_skills: ['electrical'], required_parts: [{ product_id: 'p1', quantity: 5 }] }),
  ],
  lanes: [lane],
};

describe('DispatcherBoardComponent', () => {
  let fixture: ComponentFixture<DispatcherBoardComponent>;
  let harness: Harness;

  const api = { getBoard: vi.fn(), listContracts: vi.fn(), dispatch: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getBoard.mockReturnValue(of({ data: board }));
    api.listContracts.mockReturnValue(of({ data: [] }));
    api.dispatch.mockReturnValue(of({ data: {} }));

    await TestBed.configureTestingModule({
      imports: [DispatcherBoardComponent],
      providers: [
        provideNzIcons(icons),
        { provide: FsmApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: I18nService, useValue: { currentLanguage: () => 'it', translate: (key: string) => key } },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DispatcherBoardComponent);
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('loads the board of the current week window', () => {
    expect(api.getBoard).toHaveBeenCalledTimes(1);
    const params = api.getBoard.mock.calls[0][0] as { from: string; to: string };
    expect(new Date(params.from).getTime()).toBe(startOfWeek(new Date()).getTime());
    expect(Date.parse(params.to) - Date.parse(params.from)).toBeGreaterThanOrEqual(6.9 * 24 * 3_600_000);
    expect(el().querySelectorAll('[data-testid^="queue-"]')).toHaveLength(2);
    expect(el().querySelector('[data-testid="lane-t1"]')).not.toBeNull();
  });

  it('flags the van stock readiness of queue entries that need parts', () => {
    expect(el().querySelector('[data-testid="queue-2"] [data-testid="van-not-ready"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="queue-1"] [data-testid="van-ready"]')).toBeNull();
  });

  it('filters the queue by priority, skills, van readiness and preventive versus corrective', () => {
    harness.setFilter('priority', 'urgent');
    expect(harness.filteredQueue().map((w) => w.work_order_id)).toEqual(['1']);
    harness.setFilter('priority', null);

    harness.setFilter('skill', 'electrical');
    expect(harness.filteredQueue().map((w) => w.work_order_id)).toEqual(['2']);
    harness.setFilter('skill', null);

    harness.setFilter('vanReadiness', 'not_ready');
    expect(harness.filteredQueue().map((w) => w.work_order_id)).toEqual(['2']);
    harness.setFilter('vanReadiness', 'all');

    harness.setFilter('kind', 'preventive');
    expect(harness.filteredQueue().map((w) => w.work_order_id)).toEqual(['1']);
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-testid^="queue-"]')).toHaveLength(1);
  });

  it('reloads the board when the week changes', () => {
    const before = harness.weekStart().getTime();
    harness.shiftWeek(1);
    expect(api.getBoard).toHaveBeenCalledTimes(2);
    expect(harness.weekStart().getTime()).toBeGreaterThan(before);
  });

  it('dispatches the work order to the chosen technician and slot, then reloads', () => {
    harness.openAssign(board.unassigned[0], lane, '2026-03-02T10:00:00.000Z');
    expect(harness.dialogTarget()?.workOrderId).toBe('1');
    expect(harness.form.getRawValue().technician_id).toBe('t1');

    harness.form.patchValue({ start: '2026-03-02T10:00', end: '2026-03-02T12:00' });
    harness.submit();

    expect(api.dispatch).toHaveBeenCalledWith('1', {
      technician_id: 't1',
      scheduled_start: new Date('2026-03-02T10:00').toISOString(),
      scheduled_end: new Date('2026-03-02T12:00').toISOString(),
    });
    expect(message.success).toHaveBeenCalled();
    expect(harness.dialogTarget()).toBeNull();
    expect(api.getBoard).toHaveBeenCalledTimes(2);
  });

  it('does not submit an inverted time range', () => {
    harness.openAssign(board.unassigned[0], lane);
    harness.form.patchValue({ start: '2026-03-02T12:00', end: '2026-03-02T10:00' });
    harness.submit();
    expect(api.dispatch).not.toHaveBeenCalled();
  });

  it('surfaces skill, schedule and stock blockers of a rejected dispatch as warnings', () => {
    api.dispatch.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { errors: { skills: ['Missing: electrical'], schedule: ['Overlap'], van_stock: ['Van short'] } },
          }),
      ),
    );
    harness.openAssign(board.unassigned[1], lane, '2026-03-02T10:00:00.000Z');
    harness.submit();

    expect(harness.blockerGroups().map((g) => g.key)).toEqual(['skills', 'schedule', 'van_stock']);
    expect(harness.dialogTarget()).not.toBeNull();
    expect(message.error).not.toHaveBeenCalled();
  });

  it('shows live warnings for the chosen technician and falls back to a toast on other errors', () => {
    harness.openAssign(board.unassigned[1], lane);
    expect(harness.liveHasWarnings()).toBe(true);

    api.dispatch.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    harness.submit();
    expect(harness.blockerGroups()).toEqual([]);
    expect(message.error).toHaveBeenCalled();
  });

  it('formats datetime-local values', () => {
    expect(toLocalInput(new Date(2026, 2, 2, 9, 5))).toBe('2026-03-02T09:05');
    expect(startOfWeek(new Date(2026, 2, 5, 15, 0)).getDay()).toBe(1);
  });
});
