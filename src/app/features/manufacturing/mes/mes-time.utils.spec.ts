import { describe, expect, it } from 'vitest';
import { formatDuration, liveTimes, rowKey } from './mes-time.utils';
import { MesPhase, MesTimes } from './mes.models';

const times = (overrides: Partial<MesTimes> = {}): MesTimes => ({
  setup_seconds: 900,
  run_seconds: 3600,
  attended_run_seconds: 1800,
  unattended_run_seconds: 1800,
  downtime_seconds: 600,
  man_seconds: 2700,
  machine_seconds: 4500,
  setup_minutes: '15.00',
  run_minutes: '60.00',
  downtime_minutes: '10.00',
  man_minutes: '45.00',
  machine_minutes: '75.00',
  man_seconds_by_operator: {},
  downtime_seconds_by_reason: {},
  ...overrides,
});

const phase = (overrides: Partial<MesPhase> = {}): MesPhase => ({
  id: 'p-1',
  version: 3,
  status: 'running',
  allowed_actions: [],
  resume_to: null,
  machine_mode: 'attended',
  operator_id: 'u-1',
  machine_id: null,
  work_center_id: 'wc-1',
  production_order: {
    id: 'o-1',
    order_number: 'PO-1',
    item_code: 'FG',
    item_name: 'Finished good',
    target_quantity: '10.0000',
  },
  operation: {
    id: 'op-1',
    sequence: 10,
    name: 'Machining',
    completed_quantity: '0.0000',
    scrapped_quantity: '0.0000',
  },
  open_interval: {
    category: 'run',
    started_at: '2026-01-05T08:00:00Z',
    machine_attended: true,
    suspension_reason: null,
  },
  times: times(),
  declared: { good_quantity: '0.0000', scrap_quantity: '0.0000' },
  consumptions_count: 0,
  taken_over_at: '2026-01-05T07:00:00Z',
  closed_at: null,
  server_time: '2026-01-05T08:30:00Z',
  ...overrides,
});

describe('liveTimes', () => {
  it('adds the elapsed seconds to man and machine time of an attended run', () => {
    expect(liveTimes(phase(), 30)).toEqual({
      setup: 900,
      run: 3630,
      downtime: 600,
      man: 2730,
      machine: 4530,
    });
  });

  it('adds an unattended run to machine time only', () => {
    const unattended = phase({
      machine_mode: 'unattended',
      open_interval: {
        category: 'run',
        started_at: '',
        machine_attended: false,
        suspension_reason: null,
      },
    });

    expect(liveTimes(unattended, 60)).toEqual({
      setup: 900,
      run: 3660,
      downtime: 600,
      man: 2700,
      machine: 4560,
    });
  });

  it('counts setup as man and machine time', () => {
    const setup = phase({
      status: 'setup',
      open_interval: {
        category: 'setup',
        started_at: '',
        machine_attended: true,
        suspension_reason: null,
      },
    });

    expect(liveTimes(setup, 10)).toEqual({
      setup: 910,
      run: 3600,
      downtime: 600,
      man: 2710,
      machine: 4510,
    });
  });

  it('never accrues man or machine time while suspended, only downtime', () => {
    const suspended = phase({
      status: 'suspended',
      open_interval: {
        category: 'suspension',
        started_at: '',
        machine_attended: false,
        suspension_reason: 'break',
      },
    });

    expect(liveTimes(suspended, 120)).toEqual({
      setup: 900,
      run: 3600,
      downtime: 720,
      man: 2700,
      machine: 4500,
    });
  });

  it('keeps the server numbers for a phase without an open interval or already closed', () => {
    expect(liveTimes(phase({ status: 'assigned', open_interval: null }), 500).man).toBe(2700);
    expect(liveTimes(phase({ status: 'closed' }), 500).machine).toBe(4500);
  });

  it('ignores a negative or fractional elapsed time', () => {
    expect(liveTimes(phase(), -5).man).toBe(2700);
    expect(liveTimes(phase(), 2.9).man).toBe(2702);
  });
});

describe('formatDuration and rowKey', () => {
  it('formats seconds as HH:MM:SS without capping the hours', () => {
    expect(formatDuration(0)).toBe('00:00:00');
    expect(formatDuration(3661)).toBe('01:01:01');
    expect(formatDuration(100 * 3600 + 5)).toBe('100:00:05');
    expect(formatDuration(-4)).toBe('00:00:00');
  });

  it('keys a phase by its id and a row nobody took over by its operation', () => {
    expect(rowKey(phase())).toBe('p-1');
    expect(rowKey(phase({ id: null }))).toBe('op:op-1');
  });
});
