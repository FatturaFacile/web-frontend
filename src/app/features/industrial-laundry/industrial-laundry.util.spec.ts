import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  certificationColor,
  dormantColor,
  errorKey,
  failureOf,
  gapColor,
  lifecycleColor,
  monthRange,
  netWeight,
  num,
  parseReads,
  ppeStatusColor,
  previousMonthRange,
  severityColor,
  wearPercent,
} from './industrial-laundry.util';

describe('industrial laundry util', () => {
  it('builds the error key from the problem code with a generic fallback', () => {
    expect(errorKey('gross_below_tare')).toBe('industrialLaundry.error.gross_below_tare');
    expect(errorKey(null)).toBe('industrialLaundry.error.generic');
  });

  it('reads the code, the parameters and the field errors of a problem response', () => {
    const outcome = failureOf(
      new HttpErrorResponse({
        status: 422,
        error: {
          code: 'locker_taken',
          detail: 'Locker taken',
          params: { locker: 'A-01' },
          errors: { locker_code: ['Taken'] },
        },
      }),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('industrialLaundry.error.locker_taken');
    expect(outcome.detail).toBe('Taken');
    expect(outcome.params).toEqual({ locker: 'A-01' });
    expect(failureOf(new Error('x')).errorKey).toBe('industrialLaundry.error.generic');
  });

  it('shows decimals as numbers', () => {
    expect(num('12.5000')).toBe(12.5);
    expect(num(3)).toBe(3);
    expect(num(null)).toBe(0);
    expect(num('abc')).toBe(0);
  });

  it('computes the net weight of a roll cage like the API: gross minus tare, three decimals', () => {
    expect(netWeight('118.5', '38.5')).toBe(80);
    expect(netWeight(120.4567, 38.25)).toBe(82.207);
    expect(netWeight('', '38.5')).toBeNull();
    expect(netWeight(null, '38.5')).toBeNull();
  });

  it('refuses a gross weight below the tare', () => {
    expect(netWeight('30', '38.5')).toBeNull();
    expect(netWeight('-1', '0')).toBeNull();
    expect(netWeight('38.5', '38.5')).toBe(0);
  });

  it('shows the wear of a garment against its certified wash limit', () => {
    expect(wearPercent(46, 50)).toBe(92);
    expect(wearPercent(52, 50)).toBe(104);
    expect(wearPercent(10, null)).toBe(0);
    expect(wearPercent(10, 0)).toBe(0);
  });

  it('parses the reads of the scan console, one tag per line', () => {
    const reads = parseReads('E28011600000000000000001, -58.5, GATE-IN-01\n\n  e28011600000000000000002\tabc\nE28011600000000000000003;-71');

    expect(reads).toEqual([
      { epc: 'E28011600000000000000001', rssi: -58.5, antenna_id: 'GATE-IN-01' },
      { epc: 'e28011600000000000000002', rssi: null, antenna_id: null },
      { epc: 'E28011600000000000000003', rssi: -71, antenna_id: null },
    ]);
    expect(parseReads('   \n\n')).toEqual([]);
  });

  it('colours states, statuses and gaps', () => {
    expect(lifecycleColor('condemned_rag')).toBe('red');
    expect(lifecycleColor('clean_in_stock')).toBe('green');
    expect(ppeStatusColor('limit_reached')).toBe('red');
    expect(ppeStatusColor('near_limit')).toBe('orange');
    expect(certificationColor('compliant')).toBe('green');
    expect(certificationColor('non_compliant')).toBe('red');
    expect(severityColor('blocking')).toBe('red');
    expect(severityColor('warning')).toBe('orange');
    expect(gapColor(5)).toBe('red');
    expect(gapColor(-3)).toBe('blue');
    expect(gapColor(0)).toBe('green');
    expect(dormantColor(70, 60)).toBe('orange');
    expect(dormantColor(120, 60)).toBe('red');
  });

  it('gives the first and last day of a month and of the previous one', () => {
    expect(monthRange(new Date(2028, 1, 15))).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(previousMonthRange(new Date(2028, 0, 10))).toEqual({ start: '2027-12-01', end: '2027-12-31' });
  });
});
