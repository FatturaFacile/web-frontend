import { describe, expect, it } from 'vitest';
import { ShiftSwapRequest } from '@core';
import {
  buildIcs,
  canRespond,
  escapeIcsText,
  foldIcsLine,
  groupByDate,
  swapRole,
  toIcsDate,
} from './my-shifts.util';

const swap = (patch: Partial<ShiftSwapRequest> = {}): ShiftSwapRequest => ({
  id: 's-1',
  requester_employee_id: 'e-1',
  target_peer_employee_id: 'e-2',
  is_broadcast: false,
  shift_assignment_id: 'a-1',
  target_shift_assignment_id: null,
  status: 'pending_peer_acceptance',
  peer_responded_at: null,
  reviewed_by_user_id: null,
  reviewed_at: null,
  rejection_reason: null,
  created_at: null,
  ...patch,
});

describe('iCalendar export', () => {
  it('writes instants in UTC without separators or milliseconds', () => {
    expect(toIcsDate('2026-03-02T06:00:00.000Z')).toBe('20260302T060000Z');
    expect(toIcsDate('2026-03-02T07:00:00+01:00')).toBe('20260302T060000Z');
  });

  it('escapes the characters RFC 5545 reserves', () => {
    expect(escapeIcsText('Night; on call, ward\\1\nlate')).toBe(
      'Night\\; on call\\, ward\\\\1\\nlate',
    );
  });

  it('folds long lines at 75 characters with a leading space on the continuation', () => {
    const folded = foldIcsLine(`SUMMARY:${'x'.repeat(100)}`).split('\r\n');

    expect(folded[0]).toHaveLength(75);
    expect(folded[1]?.startsWith(' ')).toBe(true);
    expect(folded.join('').replace(/ /g, '')).toBe(`SUMMARY:${'x'.repeat(100)}`);
  });

  it('builds one event per shift inside a calendar', () => {
    const ics = buildIcs(
      [
        {
          id: 'a-1',
          start_at: '2026-03-02T21:00:00Z',
          end_at: '2026-03-03T05:00:00Z',
          summary: 'Night',
        },
      ],
      new Date('2026-03-01T10:00:00Z'),
    );

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:a-1@fatturafacile');
    expect(ics).toContain('DTSTAMP:20260301T100000Z');
    expect(ics).toContain('DTSTART:20260302T210000Z');
    expect(ics).toContain('DTEND:20260303T050000Z');
    expect(ics).toContain('SUMMARY:Night');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});

describe('agenda and swap helpers', () => {
  it('groups by day in date order', () => {
    const groups = groupByDate([
      { shift_date: '2026-03-03', id: 'b' },
      { shift_date: '2026-03-02', id: 'a' },
      { shift_date: '2026-03-03', id: 'c' },
    ]);

    expect(groups.map(([day, items]) => [day, items.map((i) => i.id)])).toEqual([
      ['2026-03-02', ['a']],
      ['2026-03-03', ['b', 'c']],
    ]);
  });

  it('tells outgoing, incoming and broadcast swaps apart', () => {
    expect(swapRole(swap(), 'e-1')).toBe('outgoing');
    expect(swapRole(swap(), 'e-2')).toBe('incoming');
    expect(swapRole(swap({ is_broadcast: true, target_peer_employee_id: null }), 'e-2')).toBe(
      'broadcast',
    );
    expect(swapRole(swap(), null)).toBe('incoming');
  });

  it('lets a colleague answer only while the swap waits for the peer', () => {
    expect(canRespond(swap(), 'e-2')).toBe(true);
    expect(canRespond(swap(), 'e-1')).toBe(false);
    expect(canRespond(swap({ status: 'pending_manager_approval' }), 'e-2')).toBe(false);
  });
});
