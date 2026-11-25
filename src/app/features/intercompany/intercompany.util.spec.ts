import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  amountOf,
  anomalyColor,
  anomalyTotal,
  attempt,
  enumKey,
  failureOf,
  icErrorCode,
  isClosedRun,
  isNonZero,
  linkStatusColor,
  matchStatusColor,
  packageFileName,
  pairKey,
  runStatusColor,
  stepIndexOf,
} from './intercompany.util';

describe('intercompany util', () => {
  it('builds the translation key of an enum label', () => {
    expect(enumKey('anomalyType', 'fx')).toBe('intercompany.enum.anomalyType.fx');
    expect(enumKey('mirrorMode', null)).toBe('intercompany.enum.mirrorMode.none');
  });

  describe('failures', () => {
    it('picks the code from the HTTP status when the API sent none', () => {
      expect(icErrorCode(409, undefined)).toBe('conflict');
      expect(icErrorCode(403, undefined)).toBe('forbidden');
      expect(icErrorCode(422, undefined)).toBe('validation');
      expect(icErrorCode(500, undefined)).toBe('generic');
      expect(icErrorCode(409, 'run_locked')).toBe('run_locked');
    });

    it('keeps the first validation message of a 422', () => {
      const outcome = failureOf(
        new HttpErrorResponse({
          status: 422,
          error: { message: 'x', errors: { reason: ['The reason is required.'] } },
        }),
      );

      expect(outcome.ok).toBe(false);
      expect(outcome.errorKey).toBe('intercompany.error.validation');
      expect(outcome.detail).toBe('The reason is required.');
      expect(outcome.errors['reason']).toEqual(['The reason is required.']);
    });

    it('maps a stale version to the conflict key', () => {
      const outcome = failureOf(
        new HttpErrorResponse({ status: 409, error: { success: false, message: 'Stale version' } }),
      );

      expect(outcome.errorKey).toBe('intercompany.error.conflict');
      expect(outcome.status).toBe(409);
    });

    it('treats anything but an HTTP error as generic', () => {
      expect(failureOf(new Error('boom')).errorKey).toBe('intercompany.error.generic');
    });

    it('attempt returns the value on success and the outcome on failure', async () => {
      expect((await attempt(() => Promise.resolve(7))).value).toBe(7);

      const failed = await attempt(() => Promise.reject(new HttpErrorResponse({ status: 404 })));
      expect(failed.value).toBeNull();
      expect(failed.outcome.errorKey).toBe('intercompany.error.not_found');
    });
  });

  describe('amounts', () => {
    it('reads decimal strings and ignores what is not a number', () => {
      expect(amountOf('1234.5000')).toBe(1234.5);
      expect(amountOf(null)).toBe(0);
      expect(amountOf('abc')).toBe(0);
      expect(isNonZero('0.0000')).toBe(false);
      expect(isNonZero('-0.0100')).toBe(true);
    });

    it('sums the anomaly counts of a matrix cell', () => {
      expect(anomalyTotal({ timing: 1, fx: 2, amount: 0, tax: 3, missing_counterpart: 1 })).toBe(7);
    });

    it('gives the same key to a pair of entities whichever side is first', () => {
      expect(pairKey('b', 'a')).toBe(pairKey('a', 'b'));
    });
  });

  describe('workflow', () => {
    it('follows the wizard step of the run status', () => {
      expect(stepIndexOf(null)).toBe(0);
      expect(stepIndexOf('draft')).toBe(0);
      expect(stepIndexOf('calculating')).toBe(1);
      expect(stepIndexOf('review')).toBe(3);
      expect(stepIndexOf('locked')).toBe(4);
      expect(stepIndexOf('posted')).toBe(4);
    });

    it('closes a run once it is locked or posted', () => {
      expect(isClosedRun('locked')).toBe(true);
      expect(isClosedRun('posted')).toBe(true);
      expect(isClosedRun('review')).toBe(false);
      expect(isClosedRun(null)).toBe(false);
    });
  });

  describe('colours', () => {
    it('marks failures red and confirmed documents green', () => {
      expect(linkStatusColor('failed')).toBe('red');
      expect(linkStatusColor('confirmed')).toBe('green');
      expect(matchStatusColor('disputed')).toBe('red');
      expect(matchStatusColor('matched')).toBe('green');
      expect(runStatusColor('locked')).toBe('green');
      expect(anomalyColor('none')).toBe('green');
      expect(anomalyColor('missing_counterpart')).toBe('red');
    });
  });

  it('names a package file after the standard and the run', () => {
    expect(packageFileName('oic17', '12345678-aaaa', 'xlsx')).toBe(
      'consolidated-package-oic17-12345678.xlsx',
    );
  });
});
