import { signal } from '@angular/core';
import { vi } from 'vitest';
import {
  AllocationMutationResult,
  CapacityCell,
  CapacityHeatmap,
  CapacityResource,
  ResourceAllocation,
  ResourceCandidate,
  Skill,
} from '@core';

/** Fixtures shared by the specs of the resource planning feature. */

export const wrap = <T>(data: T) => ({ success: true, message: 'ok', data });

export const periods = ['2026-03-02', '2026-03-09', '2026-03-16'];

export function capacityCell(
  period: string,
  load: number,
  overrides: Partial<CapacityCell> = {},
): CapacityCell {
  return {
    period_start: period,
    contractual_hours: 40,
    leave_and_holiday_hours: 0,
    net_available_hours: 40,
    hard_booked_hours: (load / 100) * 40,
    soft_booked_hours: 0,
    billable_booked_hours: (load / 100) * 40,
    internal_booked_hours: 0,
    load_percent: load,
    band: load > 100 ? 'red' : load >= 80 ? 'yellow' : 'green',
    is_overloaded: load > 100,
    ...overrides,
  };
}

export const heatmap: CapacityHeatmap = {
  from: '2026-03-02',
  to: '2026-03-22',
  granularity: 'week',
  thresholds: { yellow: 80, red: 100 },
  periods,
  rows: [
    {
      employee_id: 'e-1',
      employee_name: 'Anna Rossi',
      department_id: 'd-1',
      department_name: 'Engineering',
      cost_center_id: null,
      weekly_contract_hours: 40,
      cells: [
        capacityCell(periods[0], 50),
        capacityCell(periods[1], 125),
        capacityCell(periods[2], 85),
      ],
    },
    {
      employee_id: 'e-2',
      employee_name: 'Bruno Bianchi',
      department_id: 'd-2',
      department_name: 'Design',
      cost_center_id: null,
      weekly_contract_hours: 40,
      cells: [
        capacityCell(periods[0], 0, {
          net_available_hours: 0,
          hard_booked_hours: 0,
          band: 'none',
        }),
        capacityCell(periods[1], 20),
        capacityCell(periods[2], 20),
      ],
    },
  ],
};

export function allocation(
  id: string,
  overrides: Partial<ResourceAllocation> = {},
): ResourceAllocation {
  return {
    id,
    project_id: 'p-1',
    project_name: 'Migration',
    wbs_node_id: null,
    wbs_node_title: null,
    employee_id: 'e-1',
    employee_name: 'Anna Rossi',
    role_id: null,
    booking_type: 'SoftTentative',
    start_date: '2026-03-09',
    end_date: '2026-03-20',
    allocated_hours_per_day: 4,
    total_allocated_hours: 40,
    is_billable: true,
    crm_opportunity_id: null,
    crm_opportunity_name: null,
    is_overloaded: false,
    peak_load_percent: 50,
    notes: null,
    ...overrides,
  };
}

export const resources: CapacityResource[] = [
  {
    employee_id: 'e-1',
    full_name: 'Anna Rossi',
    department_id: 'd-1',
    department_name: 'Engineering',
    cost_center_id: 'c-1',
    cost_center_name: 'CC Engineering',
    weekly_contract_hours: 40,
    fte_ratio: 1,
    hourly_cost: 60,
    country: 'CH',
    region: 'TI',
  },
  {
    employee_id: 'e-2',
    full_name: 'Bruno Bianchi',
    department_id: 'd-2',
    department_name: 'Design',
    cost_center_id: null,
    cost_center_name: null,
    weekly_contract_hours: 32,
    fte_ratio: 0.8,
    hourly_cost: 50,
    country: 'IT',
    region: null,
  },
];

export const skills: Skill[] = [
  {
    id: 's-1',
    category: 'Engineering',
    skill_name: 'Angular',
    requires_certification: false,
    certification_code: null,
  },
  {
    id: 's-2',
    category: 'Safety',
    skill_name: 'Forklift',
    requires_certification: true,
    certification_code: 'FORKLIFT',
  },
];

export function mutationResult(
  overrides: Partial<AllocationMutationResult> = {},
): AllocationMutationResult {
  return {
    allocation: allocation('a-1'),
    allocations: [allocation('a-1')],
    overload: { is_overloaded: false, peak_load_percent: 50, weeks: [] },
    warnings: [],
    ...overrides,
  };
}

export function candidate(
  overrides: Partial<ResourceCandidate> = {},
): ResourceCandidate {
  return {
    employee_id: 'e-2',
    employee_name: 'Bruno Bianchi',
    department_name: 'Design',
    score: 88,
    eligible: true,
    matched_skills: [
      {
        skill_id: 's-1',
        skill_name: 'Angular',
        level: 4,
        min_level: 3,
        valid_until_date: null,
        certification_status: 'not_required',
      },
    ],
    blockers: [],
    available_hours: 60,
    requested_hours: 40,
    residual_hours_per_day: 3.5,
    peak_load_after_percent: 72.5,
    hourly_cost: 50,
    ...overrides,
  };
}

/** Stand-in of the translation service: keys come back unchanged so the specs can assert on them. */
export function translateSpy() {
  return {
    instant: vi.fn((key: string) => key),
    translate: vi.fn((key: string) => key),
    currentLanguage: signal('en'),
  };
}

export function dragEvent(overrides: Record<string, unknown> = {}): DragEvent {
  return {
    dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    shiftKey: false,
    ...overrides,
  } as unknown as DragEvent;
}
