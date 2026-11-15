import { describe, expect, it } from 'vitest';
import { parseTemplateTasks } from './offboarding-template.util';

describe('parseTemplateTasks', () => {
  it('reads title, code and days of each line and skips empty lines', () => {
    expect(parseTemplateTasks('Return the laptop | asset_return | 0\n\n  Exit interview | exit_interview | -3  \nHand over projects')).toEqual([
      { title: 'Return the laptop', code: 'asset_return', due_after_days: 0 },
      { title: 'Exit interview', code: 'exit_interview', due_after_days: -3 },
      { title: 'Hand over projects' },
    ]);
  });

  it('turns an unknown code into a custom task and drops a wrong number of days', () => {
    expect(parseTemplateTasks('Collect badge | badge | soon')).toEqual([{ title: 'Collect badge', code: 'custom' }]);
  });

  it('returns nothing for empty text', () => {
    expect(parseTemplateTasks('  \n ')).toEqual([]);
  });
});
